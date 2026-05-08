const pool = require('../config/db');
const { gerarRoteiroCompleto } = require('../services/itineraryService');
const { formatarDistancia, haversine } = require('../services/routeService');

function normalizarHorario(horario) {
  if (!horario) return '09:00';
  if (/^\d{1,2}:\d{2}$/.test(horario)) return horario.padStart(5, '0');
  if (/^\d{1,2}h/i.test(horario)) {
    const h = parseInt(horario);
    return `${String(h).padStart(2, '0')}:00`;
  }
  const mapa = {
    'manha': '09:00', 'manhã': '09:00', 'morning': '09:00',
    'meio-dia': '12:00', 'meio dia': '12:00',
    'almoco': '12:30', 'almoço': '12:30',
    'tarde': '14:30', 'afternoon': '14:30',
    'noite': '19:30', 'evening': '19:30', 'night': '20:00',
    'cafe': '08:00', 'café': '08:00', 'breakfast': '08:00',
    'jantar': '19:30', 'dinner': '19:30',
  };
  const chave = horario.toLowerCase().trim();
  return mapa[chave] || '09:00';
}

function normalizarCusto(custo) {
  if (custo === null || custo === undefined) return 0;
  if (typeof custo === 'number') return custo;
  if (typeof custo === 'string') {
    const limpo = custo.replace(/[^\d.,]/g, '').replace(',', '.');
    const num = parseFloat(limpo);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

function mapearTipoAtividade(type, category) {
  const mapa = {
    'restaurante': 'restaurante',
    'café': 'restaurante',
    'bar': 'vida_noturna',
    'pub': 'vida_noturna',
    'fast food': 'restaurante',
    'sorveteria': 'restaurante',
    'museu': 'cultural',
    'teatro': 'cultural',
    'galeria': 'cultural',
    'centro cultural': 'cultural',
    'templo/igreja': 'cultural',
    'parque': 'natureza',
    'jardim': 'natureza',
    'mirante': 'ponto_turistico',
    'monumento': 'ponto_turistico',
    'memorial': 'ponto_turistico',
    'atração': 'ponto_turistico',
  };

  if (mapa[type]) return mapa[type];
  if (category === 'gastronomia') return 'restaurante';
  if (category === 'cultural') return 'cultural';
  if (category === 'natureza') return 'natureza';
  if (category === 'histórico') return 'ponto_turistico';
  return 'ponto_turistico';
}

const gerarRoteiro = async (req, res) => {
  const { id_viagem } = req.body;
  const id_usuario = req.usuario.id;

  try {
    if (!id_viagem) {
      return res.status(400).json({ mensagem: 'ID da viagem é obrigatório!' });
    }

    const viagem = await pool.query(
      'SELECT * FROM viagem WHERE id_viagem = $1 AND fk_usuario_id_usuario = $2',
      [id_viagem, id_usuario]
    );

    if (viagem.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Viagem não encontrada.' });
    }

    const v = viagem.rows[0];
    console.log('='.repeat(60));
    console.log(`[Roteiro] INICIANDO geração para "${v.destino}" (${v.quantidade_dias} dias)`);
    console.log(`[Roteiro] Preferências: ${v.nome_preferencia || 'nenhuma'}`);
    console.log(`[Roteiro] Orçamento: ${v.orcamento || 'flexível'}`);
    console.log(`[Roteiro] Transporte: ${v.meio_transporte || 'não informado'}`);
    console.log('='.repeat(60));

    let resultado;
    try {
      resultado = await gerarRoteiroCompleto(v);
    } catch (erroGeracao) {
      console.error('[Roteiro] Exceção na geração:', erroGeracao.message);
      return res.status(500).json({
        mensagem: `Erro ao gerar roteiro: ${erroGeracao.message}`,
      });
    }

    if (!resultado.sucesso) {
      console.error('[Roteiro] Falha na geração:', resultado.resultado.erros);
      return res.status(422).json({
        mensagem: `Não foi possível gerar o roteiro: ${resultado.resultado.erros.join(', ')}`,
        erros: resultado.resultado.erros,
      });
    }

    const { roteiro: roteiroGerado, cidadeInfo, infoCidade, lugaresValidos, totalLugaresEncontrados, totalAposValidacao } = resultado;
    const centro = { lat: cidadeInfo.latitude, lng: cidadeInfo.longitude };

    const lugaresExtras = lugaresValidos
      .filter(l => {
        const usadoNoRoteiro = roteiroGerado.days.some(dia =>
          dia.activities.some(a => a.placeId === l.id)
        );
        return !usadoNoRoteiro;
      })
      .slice(0, 10)
      .map(l => ({
        nome: l.name,
        tipo: mapearTipoAtividade(l.type, l.category),
        descricao: l.description || '',
        lat: l.latitude,
        lng: l.longitude,
        endereco: l.address || '',
        distancia: formatarDistancia(
          haversine(cidadeInfo.latitude, cidadeInfo.longitude, l.latitude, l.longitude) * 1000
        ) + ' do centro',
      }));

    const metadados = JSON.stringify({
      mensagem_pessoal: roteiroGerado.mensagem_pessoal || '',
      info_cidade: {
        historia: infoCidade?.summary || '',
        curiosidades: '',
        clima: '',
        populacao: '',
        dica_geral: '',
        principais_atracoes: '',
        gastronomia: '',
        wikipediaUrl: infoCidade?.wikipediaUrl || '',
      },
      centro,
      locais_proximos: lugaresExtras,
      meio_transporte: v.meio_transporte,
      preferencias: v.nome_preferencia,
      detalhes_extra: v.detalhes_extra,
      fontes_dados: {
        roteiro: process.env.GEMINI_API_KEY ? 'IA (Gemini) + OpenStreetMap' : 'OpenStreetMap (organização local)',
        geocodificacao: 'Nominatim/OpenStreetMap',
        lugares: 'Overpass API (OpenStreetMap)',
        restaurantes: 'Overpass API (OpenStreetMap)',
        descricoes: 'Wikipedia',
        rotas: 'OSRM',
      },
      gerado_por_ia: !!process.env.GEMINI_API_KEY,
      total_lugares_encontrados: totalLugaresEncontrados,
      total_lugares_validados: totalAposValidacao,
    });

    const titulo = `Roteiro para ${cidadeInfo.cidade}`;
    const descricao = roteiroGerado.overview || `Roteiro de ${v.quantidade_dias} dia(s) em ${cidadeInfo.cidade} com lugares reais verificados.`;

    const novoRoteiro = await pool.query(
      'INSERT INTO roteiro (titulo, descricao, status, metadados, fk_viagem_id_viagem) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [titulo, descricao, 'gerado', metadados, id_viagem]
    );

    const id_roteiro = novoRoteiro.rows[0].id_roteiro;

    let totalAtividades = 0;
    for (const dia of roteiroGerado.days) {
      for (const ativ of (dia.activities || [])) {
        const tipoFinal = mapearTipoAtividade(ativ.type, '');
        const horarioFinal = normalizarHorario(ativ.suggestedTime);
        const custoFinal = normalizarCusto(ativ.estimatedCost);
        const enderecoFinal = ativ.address || cidadeInfo.displayName;
        const deslocamento = ativ.deslocamento_proximo || '';

        await pool.query(
          `INSERT INTO atividade (nome_atividade, descricao, local, dia, horario, custo_estimado, lat, lng, tipo, tempo_visita, deslocamento_proximo, realizada, fk_roteiro_id_roteiro)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            ativ.name,
            ativ.description || '',
            enderecoFinal,
            dia.day,
            horarioFinal,
            custoFinal,
            ativ.latitude || 0,
            ativ.longitude || 0,
            tipoFinal,
            ativ.estimatedVisitDuration || '',
            deslocamento,
            false,
            id_roteiro,
          ]
        );
        totalAtividades++;
      }
    }

    console.log('='.repeat(60));
    console.log(`[Roteiro] CONCLUÍDO!`);
    console.log(`[Roteiro] Fonte: ${process.env.GEMINI_API_KEY ? 'IA + OpenStreetMap' : 'OpenStreetMap (local)'}`);
    console.log(`[Roteiro] Total: ${totalAtividades} atividades em ${roteiroGerado.days.length} dia(s)`);
    console.log(`[Roteiro] Lugares reais: ${totalLugaresEncontrados} encontrados, ${totalAposValidacao} validados`);
    console.log(`[Roteiro] ID do roteiro: ${id_roteiro}`);
    console.log('='.repeat(60));

    res.status(201).json({
      mensagem: `Roteiro gerado com ${totalAtividades} atividades usando dados reais de ${cidadeInfo.cidade}!`,
      roteiro: novoRoteiro.rows[0],
      dias: roteiroGerado.days,
      gerado_por_ia: !!process.env.GEMINI_API_KEY,
      total_atividades: totalAtividades,
      total_lugares_reais: totalAposValidacao,
    });
  } catch (erro) {
    console.error('[Roteiro] ERRO FATAL ao gerar roteiro:', erro);
    res.status(500).json({ mensagem: 'Erro ao gerar roteiro.' });
  }
};

const listarRoteiros = async (req, res) => {
  const id_usuario = req.usuario.id;
  try {
    const roteiros = await pool.query(
      `SELECT r.*, v.destino, v.quantidade_dias FROM roteiro r JOIN viagem v ON r.fk_viagem_id_viagem = v.id_viagem WHERE v.fk_usuario_id_usuario = $1 ORDER BY r.data_criacao DESC`,
      [id_usuario]
    );
    res.json({ roteiros: roteiros.rows });
  } catch (erro) {
    console.error('Erro ao listar roteiros:', erro);
    res.status(500).json({ mensagem: 'Erro ao listar roteiros.' });
  }
};

const buscarRoteiro = async (req, res) => {
  const { id_roteiro } = req.params;
  const id_usuario = req.usuario.id;

  try {
    const roteiro = await pool.query(
      `SELECT r.*, v.destino, v.quantidade_dias, v.orcamento, v.nome_preferencia, v.meio_transporte, v.detalhes_extra
       FROM roteiro r JOIN viagem v ON r.fk_viagem_id_viagem = v.id_viagem
       WHERE r.id_roteiro = $1 AND v.fk_usuario_id_usuario = $2`,
      [id_roteiro, id_usuario]
    );

    if (roteiro.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Roteiro não encontrado.' });
    }

    const atividades = await pool.query(
      'SELECT * FROM atividade WHERE fk_roteiro_id_roteiro = $1 ORDER BY dia ASC, horario ASC',
      [id_roteiro]
    );

    const atividadesPorDia = {};
    for (const ativ of atividades.rows) {
      const dia = ativ.dia || 1;
      if (!atividadesPorDia[dia]) atividadesPorDia[dia] = [];
      atividadesPorDia[dia].push(ativ);
    }

    const dias = Object.keys(atividadesPorDia)
      .sort((a, b) => a - b)
      .map(dia => ({ dia: parseInt(dia), atividades: atividadesPorDia[dia] }));

    let metadados = {};
    try {
      metadados = roteiro.rows[0].metadados ? JSON.parse(roteiro.rows[0].metadados) : {};
    } catch {
      metadados = {};
    }

    res.json({ roteiro: roteiro.rows[0], dias, metadados });
  } catch (erro) {
    console.error('Erro ao buscar roteiro:', erro);
    res.status(500).json({ mensagem: 'Erro ao buscar roteiro.' });
  }
};

const excluirRoteiro = async (req, res) => {
  const { id_roteiro } = req.params;
  const id_usuario = req.usuario.id;
  try {
    const roteiro = await pool.query(
      `SELECT r.id_roteiro FROM roteiro r JOIN viagem v ON r.fk_viagem_id_viagem = v.id_viagem WHERE r.id_roteiro = $1 AND v.fk_usuario_id_usuario = $2`,
      [id_roteiro, id_usuario]
    );
    if (roteiro.rows.length === 0) return res.status(404).json({ mensagem: 'Roteiro não encontrado.' });
    await pool.query('DELETE FROM roteiro WHERE id_roteiro = $1', [id_roteiro]);
    res.json({ mensagem: 'Roteiro excluído com sucesso!' });
  } catch (erro) {
    console.error('Erro ao excluir roteiro:', erro);
    res.status(500).json({ mensagem: 'Erro ao excluir roteiro.' });
  }
};

module.exports = { gerarRoteiro, listarRoteiros, buscarRoteiro, excluirRoteiro };

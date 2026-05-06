const pool = require('../config/db');
const { geocodificarCidade } = require('../services/geocodeService');
const { buscarTodosLugares } = require('../services/placesService');
const { calcularDistanciasEntreLocais, formatarDistancia } = require('../services/routeService');

function montarPromptComDadosReais(viagem, lugaresReais, geoInfo) {
  const lugaresJSON = JSON.stringify(lugaresReais.map(l => ({
    id: l.id,
    name: l.name,
    type: l.type,
    address: l.address,
    latitude: l.latitude,
    longitude: l.longitude,
    source: l.source,
    description: l.description,
    rating: l.rating,
    categories: l.categories
  })), null, 2);

  return `Você é um planejador de viagens.

Monte um roteiro personalizado usando SOMENTE os lugares fornecidos na lista abaixo.

Regras obrigatórias:
- Não invente nomes de locais.
- Não crie restaurantes ou pontos turísticos fora da lista.
- Se não houver dados suficientes, informe que existem poucas opções disponíveis.
- Organize os locais por proximidade geográfica dentro do mesmo dia.
- Considere preferências, dias, orçamento e meio de transporte do usuário.
- Coloque restaurantes nos horários de almoço (12h) e jantar (19h-20h).
- Gere entre 4 e 6 atividades por dia, mesclando atrações e restaurantes.
- Para cada atividade, use EXATAMENTE o campo "id" do lugar original.
- Retorne o roteiro em JSON estruturado.

Dados do usuário:
Cidade: ${viagem.destino}
Dias: ${viagem.quantidade_dias}
Preferências: ${viagem.nome_preferencia || 'Nenhuma específica'}
Transporte: ${viagem.meio_transporte || 'A pé'}
Orçamento: ${viagem.orcamento ? `R$${viagem.orcamento}` : 'Não informado'}
Detalhes extras: ${viagem.detalhes_extra || 'Nenhum'}

Informações geográficas:
Cidade: ${geoInfo.cityName}, ${geoInfo.state}, ${geoInfo.country}
Centro: lat ${geoInfo.lat}, lng ${geoInfo.lng}

Lugares reais disponíveis (${lugaresReais.length} locais):
${lugaresJSON}

Retorne APENAS JSON válido (sem markdown, sem texto extra, sem blocos de código) neste formato:
{
  "titulo": "Título criativo do roteiro",
  "descricao": "Descrição geral personalizada da viagem",
  "resumo": "Resumo curto da viagem personalizada",
  "mensagem_pessoal": "Mensagem calorosa de boas-vindas mencionando a cidade e estilo do viajante",
  "info_cidade": {
    "historia": "Breve história da cidade em 3-4 frases",
    "curiosidades": "3-4 curiosidades separadas por ponto",
    "clima": "Clima típico",
    "populacao": "População aproximada",
    "dica_geral": "Dica para visitantes",
    "principais_atracoes": "5 atrações mais importantes",
    "gastronomia": "Pratos típicos e culinária"
  },
  "dias": [
    {
      "dia": 1,
      "titulo": "Título do dia",
      "atividades": [
        {
          "placeId": "id_real_do_lugar_da_lista",
          "nome": "Nome EXATO do lugar da lista",
          "tipo": "ponto_turistico | restaurante | cultural | natureza | experiencia_local",
          "horarioSugerido": "09:00",
          "tempoEstimado": "1h30",
          "descricao": "Descrição personalizada sobre o lugar e por que visitar",
          "motivoDaSugestao": "Por que este local combina com o perfil do viajante",
          "latitude": -29.000,
          "longitude": -50.000,
          "custoEstimado": 50.00
        }
      ]
    }
  ]
}

Tipos válidos para "tipo": ponto_turistico, restaurante, cultural, natureza, compras, vida_noturna, experiencia_local.
Custos em reais (R$).`;
}

function mapearTipoParaAtividade(type) {
  const mapa = {
    attraction: 'ponto_turistico',
    museum: 'cultural',
    park: 'natureza',
    experience: 'experiencia_local',
    restaurant: 'restaurante'
  };
  return mapa[type] || 'ponto_turistico';
}

function gerarRoteiroTemplateDeDadosReais(viagem, lugaresReais, geoInfo) {
  const dias = parseInt(viagem.quantidade_dias) || 1;

  const atracoes = lugaresReais.filter(l => l.type !== 'restaurant');
  const restaurantes = lugaresReais.filter(l => l.type === 'restaurant');

  const roteiroDias = [];
  let idxAtracao = 0;
  let idxRestaurante = 0;

  for (let dia = 1; dia <= dias; dia++) {
    const atividades = [];

    if (atracoes[idxAtracao]) {
      atividades.push(criarAtividadeReal(atracoes[idxAtracao], '09:00', '2h'));
      idxAtracao++;
    }
    if (atracoes[idxAtracao]) {
      atividades.push(criarAtividadeReal(atracoes[idxAtracao], '10:30', '1h30'));
      idxAtracao++;
    }
    if (restaurantes[idxRestaurante]) {
      atividades.push(criarAtividadeReal(restaurantes[idxRestaurante], '12:30', '1h30'));
      idxRestaurante++;
    }
    if (atracoes[idxAtracao]) {
      atividades.push(criarAtividadeReal(atracoes[idxAtracao], '14:30', '2h'));
      idxAtracao++;
    }
    if (restaurantes[idxRestaurante]) {
      atividades.push(criarAtividadeReal(restaurantes[idxRestaurante], '19:00', '1h30'));
      idxRestaurante++;
    }

    if (atividades.length === 0) {
      atividades.push({
        placeId: `template_dia_${dia}`,
        nome: `Explorar ${viagem.destino} - Dia ${dia}`,
        tipo: 'ponto_turistico',
        horarioSugerido: '09:00',
        tempoEstimado: '3h',
        descricao: `Explore livremente ${viagem.destino}. Caminhe pelas ruas, descubra o comércio local e aproveite o dia.`,
        motivoDaSugestao: 'Exploração livre',
        latitude: geoInfo.lat + (dia * 0.002),
        longitude: geoInfo.lng + (dia * 0.003),
        custoEstimado: 0
      });
    }

    roteiroDias.push({ dia, titulo: `Dia ${dia} em ${viagem.destino}`, atividades });
  }

  return {
    titulo: `Roteiro para ${viagem.destino}`,
    descricao: `Roteiro com dados reais para ${viagem.destino} com ${dias} dia(s)`,
    resumo: `Viagem de ${dias} dia(s) para ${viagem.destino}`,
    mensagem_pessoal: `Preparamos um roteiro com locais reais de ${viagem.destino} para você!`,
    info_cidade: {
      historia: `${geoInfo.cityName} é um destino incrível com rica história e cultura.`,
      curiosidades: 'Destino popular entre turistas de diversas partes.',
      clima: 'Variado conforme a estação.',
      populacao: 'Consulte fontes locais.',
      dica_geral: 'Aproveite a gastronomia e os pontos turísticos!',
      principais_atracoes: atracoes.slice(0, 5).map(a => a.name).join(', ') || 'Diversos pontos turísticos',
      gastronomia: restaurantes.slice(0, 3).map(r => r.name).join(', ') || 'Culinária regional'
    },
    dias: roteiroDias
  };
}

function criarAtividadeReal(lugar, horario, tempo) {
  return {
    placeId: lugar.id,
    nome: lugar.name,
    tipo: mapearTipoParaAtividade(lugar.type),
    horarioSugerido: horario,
    tempoEstimado: tempo,
    descricao: lugar.description || `Visite ${lugar.name}`,
    motivoDaSugestao: `Fonte: ${lugar.source}`,
    latitude: lugar.latitude,
    longitude: lugar.longitude,
    custoEstimado: 0
  };
}

function validarRoteiroContraLugares(roteiroIA, lugaresReais) {
  const idsValidos = new Set(lugaresReais.map(l => l.id));
  const lugaresMap = new Map(lugaresReais.map(l => [l.id, l]));

  let removidos = 0;

  for (const dia of (roteiroIA.dias || [])) {
    const atividadesValidadas = [];

    for (const ativ of (dia.atividades || [])) {
      if (ativ.placeId && idsValidos.has(ativ.placeId)) {
        const lugarReal = lugaresMap.get(ativ.placeId);
        ativ.latitude = lugarReal.latitude;
        ativ.longitude = lugarReal.longitude;
        ativ.nome = lugarReal.name;
        ativ.source = lugarReal.source;
        atividadesValidadas.push(ativ);
      } else {
        const match = lugaresReais.find(l =>
          l.name.toLowerCase().trim() === (ativ.nome || '').toLowerCase().trim()
        );
        if (match) {
          ativ.placeId = match.id;
          ativ.latitude = match.latitude;
          ativ.longitude = match.longitude;
          ativ.nome = match.name;
          ativ.source = match.source;
          atividadesValidadas.push(ativ);
        } else {
          removidos++;
          console.warn(`[Validação] Removido lugar não encontrado na lista real: "${ativ.nome}" (placeId: ${ativ.placeId})`);
        }
      }
    }

    dia.atividades = atividadesValidadas;
  }

  if (removidos > 0) {
    console.log(`[Validação] ${removidos} lugar(es) removido(s) por não existirem na lista real.`);
  }

  return roteiroIA;
}

async function calcularDeslocamentos(atividades) {
  if (atividades.length < 2) return atividades;

  const locais = atividades.map(a => ({
    name: a.nome,
    latitude: a.latitude,
    longitude: a.longitude
  }));

  const trechos = await calcularDistanciasEntreLocais(locais);

  for (let i = 0; i < atividades.length; i++) {
    if (trechos[i]) {
      const t = trechos[i];
      atividades[i].distancia_proxima_km = parseFloat((t.distanciaMetros / 1000).toFixed(2));
      atividades[i].deslocamento_proximo = `${t.distanciaTexto}${t.duracaoTexto ? ` • ${t.duracaoTexto}` : ''}`;
    }
  }

  return atividades;
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

    console.log(`[Roteiro] Iniciando geração para "${v.destino}" (${v.quantidade_dias} dias)`);

    // 1. Geocodificar cidade
    console.log('[Roteiro] Geocodificando cidade...');
    const geoInfo = await geocodificarCidade(v.destino);
    console.log(`[Roteiro] Cidade: ${geoInfo.cityName}, ${geoInfo.state}, ${geoInfo.country} (${geoInfo.lat}, ${geoInfo.lng})`);

    // 2. Buscar lugares reais
    console.log('[Roteiro] Buscando atrações e restaurantes reais...');
    const lugaresReais = await buscarTodosLugares(geoInfo.lat, geoInfo.lng, geoInfo.cityName || v.destino);
    console.log(`[Roteiro] Encontrados ${lugaresReais.length} lugar(es) real(is)`);

    const atracoes = lugaresReais.filter(l => l.type !== 'restaurant');
    const restaurantes = lugaresReais.filter(l => l.type === 'restaurant');
    console.log(`[Roteiro] ${atracoes.length} atrações, ${restaurantes.length} restaurantes`);

    let roteiroGerado;
    let geradoPorIA = false;
    const lugaresInsuficientes = lugaresReais.length < 3;

    // 3. Gerar roteiro com IA (usando lista restrita de lugares reais)
    if (process.env.GEMINI_API_KEY && lugaresReais.length >= 3) {
      try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = montarPromptComDadosReais(v, lugaresReais, geoInfo);

        const systemInstr = 'Você é um planejador de viagens especialista. Use APENAS os lugares fornecidos na lista. Retorne apenas JSON válido, sem markdown, sem texto extra, sem blocos de código.';
        const resultado = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: systemInstr + '\n\n' + prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8000 }
        });

        const conteudo = resultado.response.text().trim();
        const jsonLimpo = conteudo.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        roteiroGerado = JSON.parse(jsonLimpo);
        geradoPorIA = true;

        // 4. Validação pós-IA
        console.log('[Roteiro] Validando roteiro contra lista de lugares reais...');
        roteiroGerado = validarRoteiroContraLugares(roteiroGerado, lugaresReais);

      } catch (erroIA) {
        console.error('[Roteiro] Erro no Gemini, usando template com dados reais:', erroIA.message);
        roteiroGerado = gerarRoteiroTemplateDeDadosReais(v, lugaresReais, geoInfo);
      }
    } else {
      if (lugaresInsuficientes) {
        console.warn('[Roteiro] Poucos lugares encontrados. Gerando template básico.');
      }
      roteiroGerado = gerarRoteiroTemplateDeDadosReais(v, lugaresReais, geoInfo);
    }

    // 5. Calcular deslocamentos reais entre os pontos
    console.log('[Roteiro] Calculando deslocamentos entre os pontos...');
    for (const dia of (roteiroGerado.dias || [])) {
      if (dia.atividades && dia.atividades.length >= 2) {
        dia.atividades = await calcularDeslocamentos(dia.atividades);
      }
    }

    // 6. Salvar no banco
    const centro = { lat: geoInfo.lat, lng: geoInfo.lng };
    const locaisProximos = lugaresReais
      .filter(l => !roteiroGerado.dias?.some(d => d.atividades?.some(a => a.placeId === l.id)))
      .slice(0, 10)
      .map(l => ({
        nome: l.name,
        tipo: mapearTipoParaAtividade(l.type),
        descricao: l.description || '',
        lat: l.latitude,
        lng: l.longitude,
        distancia: formatarDistancia(
          haversineDist(geoInfo.lat, geoInfo.lng, l.latitude, l.longitude) * 1000
        ) + ' do centro',
        dica: l.source === 'Wikipedia' ? 'Dado da Wikipedia' : 'Dado do Nominatim/OSM',
        source: l.source
      }));

    const metadados = JSON.stringify({
      mensagem_pessoal: roteiroGerado.mensagem_pessoal || '',
      info_cidade: roteiroGerado.info_cidade || {},
      centro,
      locais_proximos: locaisProximos,
      meio_transporte: v.meio_transporte,
      preferencias: v.nome_preferencia,
      detalhes_extra: v.detalhes_extra,
      fontes_dados: {
        atracoes: 'Wikipedia Geosearch',
        restaurantes: 'Nominatim/OpenStreetMap',
        rotas: 'OSRM',
        geocodificacao: 'Nominatim'
      },
      total_lugares_encontrados: lugaresReais.length,
      gerado_por_ia: geradoPorIA,
      lugares_insuficientes: lugaresInsuficientes
    });

    const novoRoteiro = await pool.query(
      'INSERT INTO roteiro (titulo, descricao, status, metadados, fk_viagem_id_viagem) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [roteiroGerado.titulo, roteiroGerado.descricao, 'gerado', metadados, id_viagem]
    );

    const id_roteiro = novoRoteiro.rows[0].id_roteiro;

    for (const dia of (roteiroGerado.dias || [])) {
      for (const ativ of (dia.atividades || [])) {
        const deslocamento = ativ.deslocamento_proximo || '';
        const distKm = ativ.distancia_proxima_km || 0;
        const deslocFinal = deslocamento || (distKm > 0 ? `${distKm} km` : '');

        await pool.query(
          `INSERT INTO atividade (nome_atividade, descricao, local, dia, horario, custo_estimado, lat, lng, tipo, tempo_visita, deslocamento_proximo, realizada, fk_roteiro_id_roteiro)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            ativ.nome,
            ativ.descricao || '',
            ativ.local || ativ.address || v.destino,
            dia.dia,
            ativ.horarioSugerido || ativ.horario || '09:00',
            ativ.custoEstimado || ativ.custo_estimado || 0,
            ativ.latitude || 0,
            ativ.longitude || 0,
            ativ.tipo || 'ponto_turistico',
            ativ.tempoEstimado || ativ.tempo_visita || '',
            deslocFinal,
            false,
            id_roteiro
          ]
        );
      }
    }

    const fontes = [];
    if (atracoes.length > 0) fontes.push(`${atracoes.length} atrações (Wikipedia)`);
    if (restaurantes.length > 0) fontes.push(`${restaurantes.length} restaurantes (Nominatim/OSM)`);

    console.log(`[Roteiro] Concluído! ${geradoPorIA ? 'Gerado por IA' : 'Template'} com ${lugaresReais.length} lugares reais.`);

    res.status(201).json({
      mensagem: geradoPorIA
        ? `Roteiro gerado com IA usando ${lugaresReais.length} lugares reais!`
        : `Roteiro gerado com ${lugaresReais.length} lugares reais encontrados.`,
      roteiro: novoRoteiro.rows[0],
      dias: roteiroGerado.dias,
      gerado_por_ia: geradoPorIA,
      fontes_dados: fontes,
      total_lugares: lugaresReais.length,
      lugares_insuficientes: lugaresInsuficientes
    });
  } catch (erro) {
    console.error('[Roteiro] Erro ao gerar roteiro:', erro);
    res.status(500).json({ mensagem: 'Erro ao gerar roteiro.' });
  }
};

function haversineDist(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = v => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


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
    } catch (e) {
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

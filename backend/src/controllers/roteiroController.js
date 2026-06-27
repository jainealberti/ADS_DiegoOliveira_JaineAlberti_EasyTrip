const pool = require('../config/db');

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function chamarGeminiComRetry(genAI, prompt, config) {
  let ultimoErro = null;
  for (const modelName of GEMINI_MODELS) {
    for (let t = 1; t <= 3; t++) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const resultado = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: config,
        });
        return resultado;
      } catch (err) {
        ultimoErro = err;
        console.error(`[Roteiro][Gemini] Modelo "${modelName}" tentativa ${t}/3 falhou: ${err.message || err}`);
        if (err.message?.includes('404') || err.message?.includes('not found')) break;
        if (err.message?.includes('API_KEY_INVALID') || err.message?.includes('PERMISSION_DENIED')) {
          throw new Error(`Chave Gemini inválida ou sem permissão: ${err.message}`);
        }
        if (err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED')) {
          throw new Error(`Cota excedida: ${err.message.substring(0, 200)}`);
        }
        if ((err.message?.includes('503') || err.message?.includes('429')) && t < 3) {
          await sleep(3000 * t);
          continue;
        }
        if (t === 3) break;
        await sleep(1000);
      }
    }
  }
  throw new Error(`Gemini indisponível — ${ultimoErro?.message || 'Nenhum modelo respondeu'}`);
}

function gerarRoteiroFallback(viagem) {
  const v = viagem;
  const dias = [];
  for (let dia = 1; dia <= v.quantidade_dias; dia++) {
    const atividades = [
      { nome_atividade: 'Café da manhã local', descricao: `Comece o dia experimentando a gastronomia de ${v.destino}`, local: `Centro de ${v.destino}`, horario: '08:00', custo_estimado: 30, tipo: 'restaurante' },
      { nome_atividade: 'Ponto turístico principal', descricao: `Visite a principal atração turística de ${v.destino}`, local: `Atração principal de ${v.destino}`, horario: '09:30', custo_estimado: 50, tipo: 'ponto_turistico' },
      { nome_atividade: 'Passeio cultural', descricao: `Explore a cultura e história local de ${v.destino}`, local: `Centro histórico de ${v.destino}`, horario: '11:00', custo_estimado: 40, tipo: 'cultural' },
      { nome_atividade: 'Almoço regional', descricao: 'Saboreie a culinária típica da região', local: `Restaurante em ${v.destino}`, horario: '13:00', custo_estimado: 70, tipo: 'restaurante' },
      { nome_atividade: 'Passeio pela natureza', descricao: `Aprecie as paisagens naturais de ${v.destino}`, local: `Parque/Natureza em ${v.destino}`, horario: '15:00', custo_estimado: 25, tipo: 'natureza' },
      { nome_atividade: 'Jantar especial', descricao: `Encerre o dia com um jantar especial em ${v.destino}`, local: `Restaurante em ${v.destino}`, horario: '19:30', custo_estimado: 100, tipo: 'restaurante' },
    ];
    dias.push({ dia, atividades });
  }
  return dias;
}

const gerarRoteiro = async (req, res) => {
  const { id_viagem } = req.body;
  const id_usuario = req.usuario.id;

  try {
    const viagem = await pool.query(
      'SELECT * FROM viagem WHERE id_viagem = $1 AND fk_usuario_id_usuario = $2',
      [id_viagem, id_usuario]
    );

    if (viagem.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Viagem não encontrada!' });
    }

    const v = viagem.rows[0];
    let roteiroDias = [];
    let metadados = {};

    if (process.env.GEMINI_API_KEY) {
      try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        let contextoExtra = '';
        if (v.nome_preferencia) contextoExtra += `\nPreferências do viajante: ${v.nome_preferencia}`;
        if (v.orcamento) contextoExtra += `\nOrçamento total: R$ ${v.orcamento}`;
        if (v.meio_transporte) contextoExtra += `\nMeio de transporte: ${v.meio_transporte}`;
        if (v.detalhes_extra) contextoExtra += `\nDetalhes extras: ${v.detalhes_extra}`;

        const prompt = `Você é um planejador de viagens especialista e guia turístico profissional. Crie um roteiro REAL, DETALHADO e COMPLETO para ${v.quantidade_dias} dia(s) em "${v.destino}".
${contextoExtra}

REGRAS OBRIGATÓRIAS:
- Use APENAS locais REAIS e que existam de verdade (verificáveis no Google Maps).
- NUNCA invente nomes de restaurantes, pontos turísticos ou experiências.
- Cada dia deve ter entre 4 e 6 atividades distribuídas ao longo do dia.
- Inclua uma mistura de: pontos turísticos, restaurantes, passeios culturais, natureza e experiências locais.
- Horários devem ser realistas e sequenciais (manhã → noite).
- Custos em Reais (R$) devem ser estimativas realistas para o destino.
- Inclua coordenadas geográficas (latitude e longitude) REAIS de cada local.
- O campo "tipo" deve ser um dos: ponto_turistico, restaurante, cultural, natureza, compras, vida_noturna, experiencia_local.
- Inclua tempo estimado de visita e como se deslocar até o próximo ponto.
- O campo "avaliacao" deve ser uma nota entre 3.0 e 5.0 baseada na reputação real do local.
- O campo "categoria" deve ser uma tag descritiva curta (ex: "mirante", "museu", "churrascaria", "praia").

Retorne APENAS um JSON válido com esta estrutura COMPLETA:
{
  "info_destino": {
    "nome_completo": "Nome da cidade, Estado/País",
    "pais": "País",
    "estado": "Estado/província",
    "descricao": "Descrição rica da cidade em 3-5 frases, destacando história, características e o que torna o destino especial",
    "melhor_epoca": "Período recomendado e motivo",
    "clima": "Tipo de clima predominante",
    "temperatura_media": "Faixa de temperatura em °C",
    "populacao": "População aproximada",
    "idioma": "Idioma(s) falado(s)",
    "moeda": "Moeda utilizada",
    "fuso_horario": "Fuso horário (ex: GMT-3)",
    "aeroporto_principal": "Nome do aeroporto mais próximo e código IATA",
    "curiosidades": ["Curiosidade 1", "Curiosidade 2", "Curiosidade 3"],
    "dicas_turista": ["Dica 1", "Dica 2", "Dica 3", "Dica 4"]
  },
  "dias": [
    {
      "dia": 1,
      "titulo": "Título temático do dia (ex: 'Explorando o Centro Histórico')",
      "atividades": [
        {
          "nome_atividade": "Nome real do local/atividade",
          "descricao": "Descrição curta e informativa (máx 100 caracteres)",
          "local": "Endereço ou localização real",
          "horario": "HH:MM",
          "custo_estimado": 50.00,
          "lat": -22.9519,
          "lng": -43.2105,
          "tipo": "ponto_turistico",
          "categoria": "mirante",
          "avaliacao": 4.7,
          "tempo_visita": "1h30",
          "deslocamento_proximo": "10 min de táxi"
        }
      ]
    }
  ],
  "estimativa_gastos": {
    "passeios": { "minimo": 200, "medio": 350, "confortavel": 500 },
    "alimentacao": { "minimo": 150, "medio": 300, "confortavel": 500 },
    "transporte": { "minimo": 50, "medio": 150, "confortavel": 300 },
    "hospedagem_diaria": { "minimo": 100, "medio": 250, "confortavel": 500 },
    "outros": { "minimo": 50, "medio": 100, "confortavel": 200 },
    "total_viagem": { "minimo": 800, "medio": 1500, "confortavel": 2500 }
  },
  "sugestoes_extras": [
    {
      "nome": "Nome real do local",
      "descricao": "Descrição curta",
      "valor_medio": 40,
      "tempo_visita": "1h",
      "categoria": "museu",
      "avaliacao": 4.5,
      "lat": -22.95,
      "lng": -43.17
    }
  ],
  "restaurantes_extras": [
    {
      "nome": "Nome real do restaurante",
      "especialidade": "Tipo de cozinha",
      "faixa_preco": "$$",
      "avaliacao": 4.6,
      "horario_funcionamento": "12h-23h",
      "endereco": "Endereço real",
      "lat": -22.95,
      "lng": -43.17
    }
  ],
  "centro": { "lat": -22.9068, "lng": -43.1729 },
  "custo_total_estimado": 1500.00,
  "dicas_gerais": "Dica rápida sobre a viagem"
}

QUANTIDADES:
- sugestoes_extras: 8 a 10 locais que NÃO estão no roteiro
- restaurantes_extras: 5 a 8 restaurantes que NÃO estão no roteiro
- curiosidades: 3 a 5
- dicas_turista: 4 a 6
- avaliacao: número entre 3.0 e 5.0 com uma casa decimal`;

        const resultado = await chamarGeminiComRetry(genAI, prompt, {
          temperature: 0.6,
          maxOutputTokens: 16384,
          responseMimeType: 'application/json',
        });

        const conteudo = resultado.response.text().trim();
        let dados;
        try {
          dados = JSON.parse(conteudo);
        } catch {
          const limpo = conteudo.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          dados = JSON.parse(limpo);
        }

        if (dados.dias && Array.isArray(dados.dias) && dados.dias.length > 0) {
          roteiroDias = dados.dias;
          metadados = {
            centro: dados.centro || null,
            custo_total_estimado: dados.custo_total_estimado || null,
            dicas_gerais: dados.dicas_gerais || '',
            gerado_por_ia: true,
            info_destino: dados.info_destino || null,
            estimativa_gastos: dados.estimativa_gastos || null,
            sugestoes_extras: dados.sugestoes_extras || [],
            restaurantes_extras: dados.restaurantes_extras || [],
          };
        } else {
          console.warn('[Roteiro] Resposta da IA sem dias válidos, usando fallback');
          roteiroDias = gerarRoteiroFallback(v);
          metadados = { gerado_por_ia: false };
        }
      } catch (iaErr) {
        console.error('[Roteiro] Erro na IA, usando fallback:', iaErr.message);
        roteiroDias = gerarRoteiroFallback(v);
        metadados = { gerado_por_ia: false, erro_ia: iaErr.message };
      }
    } else {
      roteiroDias = gerarRoteiroFallback(v);
      metadados = { gerado_por_ia: false };
    }

    const novoRoteiro = await pool.query(
      'INSERT INTO roteiro (titulo, descricao, status, metadados, fk_viagem_id_viagem) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [
        `Roteiro - ${v.destino}`,
        `Roteiro de ${v.quantidade_dias} dia(s) em ${v.destino}`,
        'gerado',
        JSON.stringify(metadados),
        id_viagem,
      ]
    );

    const id_roteiro = novoRoteiro.rows[0].id_roteiro;

    for (const dia of roteiroDias) {
      for (const ativ of dia.atividades) {
        await pool.query(
          `INSERT INTO atividade (nome_atividade, descricao, local, dia, horario, custo_estimado, lat, lng, tipo, tempo_visita, deslocamento_proximo, fk_roteiro_id_roteiro)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            ativ.nome_atividade || ativ.nome || 'Atividade',
            ativ.descricao || '',
            ativ.local || '',
            dia.dia,
            ativ.horario || null,
            ativ.custo_estimado || 0,
            ativ.lat || null,
            ativ.lng || null,
            ativ.tipo || 'ponto_turistico',
            ativ.tempo_visita || null,
            ativ.deslocamento_proximo || null,
            id_roteiro,
          ]
        );
      }
    }

    res.status(201).json({
      mensagem: 'Roteiro gerado com sucesso!',
      roteiro: novoRoteiro.rows[0],
      dias: roteiroDias,
    });

  } catch (erro) {
    console.error('[Roteiro] Erro ao gerar roteiro:', erro);
    res.status(500).json({ mensagem: 'Erro ao gerar roteiro', erro: erro.message });
  }
};

const listarRoteiros = async (req, res) => {
  const id_usuario = req.usuario.id;

  try {
    const roteiros = await pool.query(
      `SELECT r.*, v.destino, v.quantidade_dias 
       FROM roteiro r 
       JOIN viagem v ON r.fk_viagem_id_viagem = v.id_viagem 
       WHERE v.fk_usuario_id_usuario = $1 
       ORDER BY r.data_criacao DESC`,
      [id_usuario]
    );

    res.json({ roteiros: roteiros.rows });
  } catch (erro) {
    res.status(500).json({ mensagem: 'Erro ao listar roteiros', erro: erro.message });
  }
};

const excluirRoteiro = async (req, res) => {
  const { id_roteiro } = req.params;
  const id_usuario = req.usuario.id;

  try {
    await pool.query(
      'DELETE FROM atividade WHERE fk_roteiro_id_roteiro = $1',
      [id_roteiro]
    );

    const resultado = await pool.query(
      `DELETE FROM roteiro WHERE id_roteiro = $1 
       AND fk_viagem_id_viagem IN (
         SELECT id_viagem FROM viagem WHERE fk_usuario_id_usuario = $2
       ) RETURNING *`,
      [id_roteiro, id_usuario]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Roteiro não encontrado!' });
    }

    res.json({ mensagem: 'Roteiro excluído com sucesso!' });
  } catch (erro) {
    res.status(500).json({ mensagem: 'Erro ao excluir roteiro', erro: erro.message });
  }
};

const buscarRoteiroPorId = async (req, res) => {
  const { id } = req.params;
  const id_usuario = req.usuario.id;

  try {
    const resultado = await pool.query(
      `SELECT r.*, v.destino, v.quantidade_dias, v.orcamento, v.nome_preferencia, v.meio_transporte, v.detalhes_extra
       FROM roteiro r
       JOIN viagem v ON r.fk_viagem_id_viagem = v.id_viagem
       WHERE r.id_roteiro = $1 AND v.fk_usuario_id_usuario = $2`,
      [id, id_usuario]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Roteiro não encontrado!' });
    }

    const roteiro = resultado.rows[0];

    const atividades = await pool.query(
      `SELECT * FROM atividade
       WHERE fk_roteiro_id_roteiro = $1
       ORDER BY dia ASC, horario ASC`,
      [id]
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
      metadados = roteiro.metadados ? JSON.parse(roteiro.metadados) : {};
    } catch {
      metadados = {};
    }

    res.json({ roteiro, dias, metadados });
  } catch (erro) {
    res.status(500).json({ mensagem: 'Erro ao buscar roteiro', erro: erro.message });
  }
};

// ─── Endpoint de enriquecimento com imagens ───

const enriquecerComImagens = async (req, res) => {
  const { id_roteiro } = req.params;
  const id_usuario = req.usuario.id;

  try {
    const resultado = await pool.query(
      `SELECT r.*, v.destino FROM roteiro r
       JOIN viagem v ON r.fk_viagem_id_viagem = v.id_viagem
       WHERE r.id_roteiro = $1 AND v.fk_usuario_id_usuario = $2`,
      [id_roteiro, id_usuario]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Roteiro não encontrado!' });
    }

    const roteiro = resultado.rows[0];
    const destino = roteiro.destino;
    let metadados = {};
    try { metadados = roteiro.metadados ? JSON.parse(roteiro.metadados) : {}; } catch { metadados = {}; }

    const { buscarImagemCidade, buscarImagemGooglePlaces } = require('../services/imageService');

    console.log(`[Enriquecer] Buscando imagens para roteiro ${id_roteiro} - ${destino}`);

    const headerImage = await buscarImagemCidade(destino);

    const atividades = await pool.query(
      'SELECT id_atividade, nome_atividade, tipo FROM atividade WHERE fk_roteiro_id_roteiro = $1 ORDER BY dia, horario',
      [id_roteiro]
    );

    const atividadeImagens = {};
    const urlsUsadas = new Set();
    if (headerImage) urlsUsadas.add(headerImage);

    for (const ativ of atividades.rows) {
      const query = `${ativ.nome_atividade} ${destino}`;
      try {
        const imgUrl = await buscarImagemGooglePlaces(query, urlsUsadas);
        if (imgUrl) {
          atividadeImagens[ativ.id_atividade] = imgUrl;
          urlsUsadas.add(imgUrl);
        }
      } catch {
        console.warn(`[Enriquecer] Falha ao buscar imagem para: ${ativ.nome_atividade}`);
      }
    }

    const sugestaoImagens = {};
    if (metadados.sugestoes_extras) {
      for (let i = 0; i < metadados.sugestoes_extras.length; i++) {
        const sug = metadados.sugestoes_extras[i];
        const query = `${sug.nome} ${destino}`;
        try {
          const imgUrl = await buscarImagemGooglePlaces(query, urlsUsadas);
          if (imgUrl) {
            sugestaoImagens[i] = imgUrl;
            urlsUsadas.add(imgUrl);
          }
        } catch {
          console.warn(`[Enriquecer] Falha em sugestão: ${sug.nome}`);
        }
      }
    }

    const restauranteImagens = {};
    if (metadados.restaurantes_extras) {
      for (let i = 0; i < metadados.restaurantes_extras.length; i++) {
        const rest = metadados.restaurantes_extras[i];
        const query = `${rest.nome} ${destino}`;
        try {
          const imgUrl = await buscarImagemGooglePlaces(query, urlsUsadas);
          if (imgUrl) {
            restauranteImagens[i] = imgUrl;
            urlsUsadas.add(imgUrl);
          }
        } catch {
          console.warn(`[Enriquecer] Falha em restaurante: ${rest.nome}`);
        }
      }
    }

    console.log(`[Enriquecer] Concluído: header=${!!headerImage}, atividades=${Object.keys(atividadeImagens).length}, sugestões=${Object.keys(sugestaoImagens).length}, restaurantes=${Object.keys(restauranteImagens).length}`);

    res.json({
      headerImage: headerImage || null,
      atividades: atividadeImagens,
      sugestoes: sugestaoImagens,
      restaurantes: restauranteImagens,
    });
  } catch (erro) {
    console.error('[Enriquecer] Erro:', erro.message);
    res.status(500).json({ mensagem: 'Erro ao enriquecer imagens', erro: erro.message });
  }
};

module.exports = { gerarRoteiro, listarRoteiros, excluirRoteiro, buscarRoteiroPorId, enriquecerComImagens };

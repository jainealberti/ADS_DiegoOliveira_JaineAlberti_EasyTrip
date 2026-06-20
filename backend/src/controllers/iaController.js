const GEMINI_MODELS = [
  'gemini-3.5-flash',
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
        console.error(`[Gemini] Modelo "${modelName}" tentativa ${t}/3 falhou: ${err.message || err}`);
        if (err.message?.includes('404') || err.message?.includes('not found')) break;
        if (err.message?.includes('API_KEY_INVALID') || err.message?.includes('PERMISSION_DENIED')) {
          throw new Error(`Chave Gemini inválida ou sem permissão: ${err.message}`);
        }
        if (err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED')) {
          throw new Error(`429 - Cota excedida: ${err.message.substring(0, 200)}`);
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
  const detalhe = ultimoErro?.message || 'Nenhum modelo respondeu';
  throw new Error(`Gemini indisponível — ${detalhe}`);
}

const gerarPreferenciasPorCidade = async (req, res) => {
  const { cidade } = req.body;

  if (!cidade || cidade.length < 2) {
    return res.status(400).json({ mensagem: 'Cidade é obrigatória.' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.json({ preferencias: gerarPreferenciasFallback(cidade) });
  }

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const prompt = `Gere 10 preferências/experiências de viagem específicas para a cidade de ${cidade}. Cada preferência deve ser algo típico ou recomendado para visitantes dessa cidade. Retorne um JSON com a estrutura: { "preferencias": [ { "id": "slug_unico", "nome": "Nome curto" } ] }`;

    const resultado = await chamarGeminiComRetry(genAI, prompt, {
      temperature: 0.7,
      maxOutputTokens: 500,
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

    res.json({ preferencias: dados.preferencias || [] });
  } catch (erro) {
    console.error('[IA] Erro ao gerar preferências:', erro.message);
    res.json({ preferencias: gerarPreferenciasFallback(cidade) });
  }
};

function gerarPreferenciasFallback(cidade) {
  return [
    { id: 'gastronomia', nome: `Gastronomia de ${cidade}` },
    { id: 'pontos_turisticos', nome: 'Pontos turísticos' },
    { id: 'cultura', nome: 'Cultura local' },
    { id: 'natureza', nome: 'Natureza e parques' },
    { id: 'compras', nome: 'Compras' },
    { id: 'vida_noturna', nome: 'Vida noturna' },
    { id: 'passeios_familia', nome: 'Passeios em família' },
    { id: 'aventura', nome: 'Aventura' },
    { id: 'romantico', nome: 'Experiências românticas' },
    { id: 'relaxamento', nome: 'Relaxamento e spa' },
  ];
}

const chatIA = async (req, res) => {
  const { mensagem, contexto, historico } = req.body;
  const id_usuario = req.usuario.id;

  if (!mensagem) {
    return res.status(400).json({ mensagem: 'Mensagem é obrigatória.' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.json({
      resposta: 'A IA não está disponível no momento. Configure a chave GEMINI_API_KEY para usar o chat.'
    });
  }

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const pool = require('../config/db');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const viagens = await pool.query(
      `SELECT v.id_viagem, v.destino, v.quantidade_dias, v.orcamento, v.meio_transporte, v.nome_preferencia
       FROM viagem v WHERE v.fk_usuario_id_usuario = $1 ORDER BY v.data_criacao DESC LIMIT 5`,
      [id_usuario]
    );

    let dadosRoteiros = '';
    if (viagens.rows.length > 0) {
      for (const v of viagens.rows) {
        const roteiros = await pool.query(
          `SELECT r.id_roteiro, r.titulo, r.descricao FROM roteiro r WHERE r.fk_viagem_id_viagem = $1 ORDER BY r.data_criacao DESC LIMIT 1`,
          [v.id_viagem]
        );
        if (roteiros.rows.length > 0) {
          const rot = roteiros.rows[0];
          const atividades = await pool.query(
            `SELECT nome_atividade, descricao, local, dia, horario, custo_estimado, tipo FROM atividade WHERE fk_roteiro_id_roteiro = $1 ORDER BY dia ASC, horario ASC`,
            [rot.id_roteiro]
          );

          dadosRoteiros += `\n\n--- VIAGEM: ${v.destino} (${v.quantidade_dias} dias) ---`;
          if (v.orcamento) dadosRoteiros += `\nOrçamento: R$ ${v.orcamento}`;
          if (v.meio_transporte) dadosRoteiros += `\nTransporte: ${v.meio_transporte}`;
          if (v.nome_preferencia) dadosRoteiros += `\nPreferências: ${v.nome_preferencia}`;
          dadosRoteiros += `\nRoteiro: ${rot.titulo}`;

          if (atividades.rows.length > 0) {
            const porDia = {};
            atividades.rows.forEach(a => {
              const d = a.dia || 1;
              if (!porDia[d]) porDia[d] = [];
              porDia[d].push(a);
            });

            Object.keys(porDia).sort((a, b) => a - b).forEach(dia => {
              dadosRoteiros += `\n  Dia ${dia}:`;
              porDia[dia].forEach(a => {
                dadosRoteiros += `\n    - ${a.horario || '??:??'} | ${a.nome_atividade}${a.local ? ' (' + a.local + ')' : ''}${a.custo_estimado > 0 ? ' | R$ ' + parseFloat(a.custo_estimado).toFixed(2) : ' | Gratuito'}`;
                if (a.descricao) dadosRoteiros += ` — ${a.descricao.substring(0, 80)}`;
              });
            });
          }
        }
      }
    }

    let systemMsg = `Você é um assistente de viagens simpático e prestativo chamado EasyTrip. Responda em português do Brasil. Use emojis quando apropriado.

REGRAS:
- Quando o usuário pedir para ver/mostrar o roteiro, apresente os dados REAIS do roteiro dele de forma organizada e bonita.
- Formate o roteiro com dia, horário, nome do local, descrição curta e custo.
- Se o usuário perguntar sobre uma viagem específica, use os dados reais abaixo.
- Seja preciso com os dados — não invente atividades que não estão no roteiro.
- Se o usuário não tiver roteiros, informe que ele precisa criar uma viagem primeiro e gerar o roteiro.`;

    if (contexto?.cidade) {
      systemMsg += `\n\nCidade de contexto atual: ${contexto.cidade}.`;
    }
    if (contexto?.destino) {
      systemMsg += `\nDestino atual: ${contexto.destino}.`;
    }

    if (dadosRoteiros) {
      systemMsg += `\n\n===== DADOS REAIS DAS VIAGENS E ROTEIROS DO USUÁRIO =====`;
      systemMsg += dadosRoteiros;
      systemMsg += `\n\n===== FIM DOS DADOS =====`;
    } else {
      systemMsg += `\n\nO usuário ainda não possui viagens ou roteiros cadastrados.`;
    }

    let conversaCompleta = systemMsg + '\n\n';
    if (historico && historico.length > 0) {
      const historicoRecente = historico.slice(-10);
      historicoRecente.forEach(msg => {
        conversaCompleta += `${msg.role === 'user' ? 'Usuário' : 'Assistente'}: ${msg.content}\n`;
      });
    }
    conversaCompleta += `Usuário: ${mensagem}\nAssistente:`;

    const resultado = await chamarGeminiComRetry(genAI, conversaCompleta, {
      temperature: 0.7,
      maxOutputTokens: 2000,
    });

    res.json({ resposta: resultado.response.text().trim() });
  } catch (erro) {
    console.error('[IA] Erro no chat:', erro.message);

    if (erro.message?.includes('429') || erro.message?.includes('quota') || erro.message?.includes('RESOURCE_EXHAUSTED')) {
      return res.json({
        resposta: '⚠️ A cota diária da IA foi excedida. O plano gratuito do Gemini tem um limite de requisições por dia.\n\nVocê pode:\n- Aguardar até amanhã para a cota ser renovada\n- Ou acessar https://ai.google.dev para verificar o status da sua cota\n\nEnquanto isso, você ainda pode navegar pelas suas viagens e roteiros normalmente!'
      });
    }

    if (erro.message?.includes('API_KEY_INVALID') || erro.message?.includes('PERMISSION_DENIED')) {
      return res.json({
        resposta: '⚠️ A chave da API de IA está inválida ou sem permissão. Verifique a configuração da GEMINI_API_KEY no servidor.'
      });
    }

    res.json({
      resposta: '😕 Desculpe, a IA está temporariamente indisponível. Tente novamente em alguns instantes.'
    });
  }
};

async function gerarExploracaoFallback(destino) {
  const { buscarImagemCidade, buscarImagensParaLista } = require('../services/imageService');

  const locais = [
    { nome: `Pontos turísticos de ${destino}`, descricao: 'Pesquise as atrações mais visitadas da região', categoria: 'monumento', avaliacao: 0, palavraChaveImagem: destino },
    { nome: `Museus de ${destino}`, descricao: 'Conheça a história e cultura local', categoria: 'museu', avaliacao: 0, palavraChaveImagem: `museum ${destino}` },
    { nome: `Parques de ${destino}`, descricao: 'Explore a natureza do destino', categoria: 'parque', avaliacao: 0, palavraChaveImagem: `park ${destino}` },
    { nome: `Mirantes de ${destino}`, descricao: 'Aprecie a paisagem urbana ou natural', categoria: 'mirante', avaliacao: 0, palavraChaveImagem: `viewpoint ${destino}` },
    { nome: `Centro histórico de ${destino}`, descricao: 'Caminhe pelas ruas com arquitetura marcante', categoria: 'centro histórico', avaliacao: 0, palavraChaveImagem: `historic center ${destino}` },
  ];

  const restaurantes = [
    { nome: `Culinária regional de ${destino}`, descricao: 'Experimente os pratos típicos da região', tipoCozinha: 'Regional', faixaPreco: '$$', palavraChaveImagem: `restaurant ${destino}` },
    { nome: `Restaurantes de ${destino}`, descricao: 'Consulte avaliações online para boas opções', tipoCozinha: 'Variada', faixaPreco: '$$$', palavraChaveImagem: `food ${destino}` },
    { nome: `Comida de rua de ${destino}`, descricao: 'Sabores locais autênticos a preços acessíveis', tipoCozinha: 'Street food', faixaPreco: '$$', palavraChaveImagem: `street food ${destino}` },
  ];

  const experiencias = [
    { nome: `Tour por ${destino}`, descricao: 'Conheça os principais pontos com guia local', tipo: 'cultural', palavraChaveImagem: `tourism ${destino}` },
    { nome: `Gastronomia de ${destino}`, descricao: 'Degustação de pratos e bebidas típicas', tipo: 'gastronômica', palavraChaveImagem: `cuisine ${destino}` },
    { nome: `Natureza em ${destino}`, descricao: 'Trilhas, passeios de barco ou caminhadas', tipo: 'natureza', palavraChaveImagem: `nature ${destino}` },
  ];

  const headerImage = await buscarImagemCidade(destino);

  const locaisComImagem = await buscarImagensParaLista(locais, destino, 'local', headerImage);
  const jantarComImagem = await buscarImagensParaLista(restaurantes, destino, 'restaurante', headerImage, locaisComImagem);
  const experienciasComImagem = await buscarImagensParaLista(experiencias, destino, 'local', headerImage, locaisComImagem, jantarComImagem);

  return {
    destino: destino,
    pais: '',
    resumo: `${destino} é um destino fascinante com cultura rica, paisagens marcantes e experiências únicas para todos os perfis de viajante. Use nosso gerador de roteiros com IA para criar um plano completo e personalizado.`,
    melhorEpoca: 'Pesquise a sazonalidade do destino para escolher a melhor época, considerando clima e eventos locais.',
    clima: 'Consulte a previsão do tempo antes de viajar para se preparar adequadamente.',
    diasRecomendados: '3 a 5 dias',
    headerImage: headerImage || null,
    locaisParaVisitar: locaisComImagem,
    ondeJantar: jantarComImagem,
    experiencias: experienciasComImagem,
    dicas: [
      'Pesquise sobre documentação necessária para o destino.',
      'Verifique a previsão do tempo antes de viajar.',
      'Reserve hospedagem e transporte com antecedência para melhores preços.',
    ],
    avisoConfiabilidade: 'Não foi possível obter informações detalhadas pela IA no momento. As sugestões acima são genéricas. Gere um roteiro completo para obter recomendações específicas e personalizadas.',
  };
}

const explorarDestino = async (req, res) => {
  const { destino } = req.body;

  if (!destino || destino.trim().length < 2) {
    return res.status(400).json({
      error: {
        code: 'INVALID_INPUT',
        message: 'O destino é obrigatório e deve ter pelo menos 2 caracteres.',
        details: [{ field: 'destino', issue: 'destino vazio ou muito curto' }],
      },
    });
  }

  const destinoLimpo = destino.trim();

  if (!process.env.GEMINI_API_KEY) {
    return res.json(await gerarExploracaoFallback(destinoLimpo));
  }

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const { buscarImagemCidade, buscarImagensParaLista } = require('../services/imageService');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const prompt = `Você é um guia de viagens especialista com conhecimento real e verificável. O usuário quer explorar: "${destinoLimpo}".

REGRAS OBRIGATÓRIAS:
- Responda em português do Brasil.
- Use APENAS informações reais e verificáveis. NUNCA invente nomes de lugares, restaurantes ou experiências.
- Todos os locais, restaurantes e experiências DEVEM ser reais, existentes e verificáveis no Google Maps.
- Para cidades brasileiras, SEMPRE inclua o estado no campo "destino" (ex: "Cunha, São Paulo", "Monte Sião, Minas Gerais", "Pirenópolis, Goiás").
- Para cidades internacionais, inclua o país (ex: "Hallstatt, Áustria").
- O campo "palavraChaveImagem" deve conter o NOME OFICIAL do local como apareceria na Wikipedia (ex: "Cristo Redentor", "Mercado Público de Porto Alegre", "Parque Ibirapuera", "Catedral da Sé"). Para locais menos conhecidos, adicione a cidade (ex: "Praça da Matriz Cunha").
- Para restaurantes: use o nome REAL e COMPLETO do restaurante. Se a cidade for pequena e você não tiver certeza de nomes reais de restaurantes, use estabelecimentos da região que você tenha certeza que existem.
- Descrições devem ter no máximo 15 palavras cada.

REGRAS PARA CIDADES PEQUENAS OU POUCO CONHECIDAS:
- Se a cidade for pequena, rural ou pouco conhecida, NÃO invente locais ou restaurantes fictícios.
- É MELHOR retornar menos itens (2-3) com informações reais do que 5-6 itens inventados.
- Para cidades pequenas, priorize: praças centrais, igrejas históricas, cachoeiras, mirantes, restaurantes na praça central, pousadas com restaurante — locais que realmente existem em cidades pequenas brasileiras.
- Se você não tem certeza se um local existe, NÃO inclua. Prefira listar atrações naturais da região (serras, cachoeiras, rios) que são verificáveis.
- No campo "avisoConfiabilidade", se a cidade for pequena/pouco turística, inclua: "Cidade de menor porte turístico — recomendamos confirmar os locais antes da viagem."

Retorne JSON com esta estrutura exata:
{
  "destino": "Nome completo da cidade, Estado/País",
  "pais": "País onde a cidade está localizada",
  "estado": "Estado/província (se aplicável)",
  "resumo": "3-4 frases descritivas sobre o destino, sua história e atrativos principais. Seja preciso e factual.",
  "melhorEpoca": "Período recomendado e motivo.",
  "clima": "Temperatura média e tipo de clima predominante.",
  "diasRecomendados": "X a Y dias",
  "locaisParaVisitar": [
    {
      "nome": "Nome real e completo do local",
      "descricao": "Descrição em até 15 palavras",
      "categoria": "monumento | museu | parque | praia | mirante | centro histórico | igreja | cachoeira | praça",
      "avaliacao": 4.7,
      "palavraChaveImagem": "Nome Oficial do Local (como na Wikipedia)"
    }
  ],
  "ondeJantar": [
    {
      "nome": "Nome REAL e COMPLETO do restaurante (que existe de verdade)",
      "descricao": "Descrição curta",
      "tipoCozinha": "Tipo de cozinha",
      "faixaPreco": "$$ | $$$ | $$$$",
      "palavraChaveImagem": "Nome Oficial do Restaurante Cidade"
    }
  ],
  "experiencias": [
    {
      "nome": "Nome da experiência",
      "descricao": "Descrição curta",
      "tipo": "aventura | cultural | gastronômica | natureza | passeio",
      "palavraChaveImagem": "Local Principal da Experiência (como na Wikipedia)"
    }
  ],
  "dicas": ["Dica prática e útil"],
  "avisoConfiabilidade": ""
}

Quantidades (AJUSTE conforme a cidade):
- Cidades grandes/turísticas: locaisParaVisitar: 5-6, ondeJantar: 3-4, experiencias: 3-4
- Cidades pequenas/pouco conhecidas: locaisParaVisitar: 2-4, ondeJantar: 2-3, experiencias: 2-3
- dicas: 3 a 5 itens
- avaliacao deve ser um número entre 3.0 e 5.0 com uma casa decimal`;

    const resultado = await chamarGeminiComRetry(genAI, prompt, {
      temperature: 0.5,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    });

    const conteudo = resultado.response.text().trim();

    let dados;
    try {
      dados = JSON.parse(conteudo);
    } catch {
      try {
        const limpo = conteudo.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        dados = JSON.parse(limpo);
      } catch {
        console.error('[IA] JSON inválido da Gemini, usando fallback');
        return res.json(await gerarExploracaoFallback(destinoLimpo));
      }
    }

    const cidadeNome = dados.destino || destinoLimpo;

    const headerImage = await buscarImagemCidade(cidadeNome);

    const locaisComImagem = await buscarImagensParaLista(dados.locaisParaVisitar || [], cidadeNome, 'local', headerImage);
    const jantarComImagem = await buscarImagensParaLista(dados.ondeJantar || [], cidadeNome, 'restaurante', headerImage, locaisComImagem);
    const experienciasComImagem = await buscarImagensParaLista(dados.experiencias || [], cidadeNome, 'local', headerImage, locaisComImagem, jantarComImagem);

    res.json({
      destino: cidadeNome,
      pais: dados.pais || '',
      resumo: dados.resumo || '',
      melhorEpoca: dados.melhorEpoca || '',
      clima: dados.clima || '',
      diasRecomendados: dados.diasRecomendados || '',
      headerImage: headerImage || null,
      locaisParaVisitar: locaisComImagem,
      ondeJantar: jantarComImagem,
      experiencias: experienciasComImagem,
      dicas: dados.dicas || [],
      avisoConfiabilidade: dados.avisoConfiabilidade || '',
    });
  } catch (erro) {
    console.error('[IA] Erro ao explorar destino:', erro.message);
    res.json(await gerarExploracaoFallback(destinoLimpo));
  }
};

module.exports = { gerarPreferenciasPorCidade, chatIA, explorarDestino };

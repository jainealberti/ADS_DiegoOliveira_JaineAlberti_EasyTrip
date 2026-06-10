const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function chamarGeminiComRetry(genAI, prompt, config) {
  for (const modelName of GEMINI_MODELS) {
    for (let t = 1; t <= 3; t++) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        return await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: config,
        });
      } catch (err) {
        if (err.message?.includes('404')) break;
        if ((err.message?.includes('503') || err.message?.includes('429')) && t < 3) {
          await sleep(3000 * t);
          continue;
        }
        if (t === 3) break;
        throw err;
      }
    }
  }
  throw new Error('Gemini indisponível');
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
  const { mensagem, contexto } = req.body;

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
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    let systemMsg = 'Você é um assistente de viagens simpático e prestativo chamado EasyTrip. Responda em português do Brasil. Seja conciso mas informativo. Use emojis quando apropriado.';

    if (contexto?.cidade) {
      systemMsg += ` O usuário está planejando ou viajando para ${contexto.cidade}.`;
    }
    if (contexto?.destino) {
      systemMsg += ` Destino atual: ${contexto.destino}.`;
    }

    const resultado = await chamarGeminiComRetry(genAI, systemMsg + '\n\n' + mensagem, {
      temperature: 0.8,
      maxOutputTokens: 1000,
    });

    res.json({ resposta: resultado.response.text().trim() });
  } catch (erro) {
    console.error('[IA] Erro no chat:', erro.message);
    res.status(500).json({ mensagem: 'Erro ao processar mensagem.' });
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

  const [locaisComImagem, jantarComImagem, experienciasComImagem] = await Promise.all([
    buscarImagensParaLista(locais, destino, 'local'),
    buscarImagensParaLista(restaurantes, destino, 'restaurante'),
    buscarImagensParaLista(experiencias, destino, 'local'),
  ]);

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

    const prompt = `Você é um guia de viagens especialista. O usuário quer explorar: "${destinoLimpo}".

REGRAS OBRIGATÓRIAS:
- Responda em português do Brasil.
- Use APENAS informações reais e verificáveis. NUNCA invente nomes de lugares, restaurantes ou experiências.
- Todos os locais, restaurantes e experiências DEVEM ser reais, existentes e verificáveis no Google Maps.
- O campo "palavraChaveImagem" deve conter o NOME EXATO do local/restaurante seguido do nome da cidade (ex: "Cristo Redentor Rio de Janeiro", "Mercado Público Porto Alegre"), para facilitar a busca de fotos reais.
- Para restaurantes: use o nome REAL e COMPLETO do restaurante (ex: "Barranco Restaurante Porto Alegre").
- Descrições devem ter no máximo 15 palavras cada.

Retorne JSON com esta estrutura exata:
{
  "destino": "Nome completo da cidade",
  "pais": "País onde a cidade está localizada",
  "resumo": "3-4 frases descritivas sobre o destino, sua história e atrativos principais.",
  "melhorEpoca": "Período recomendado e motivo.",
  "clima": "Temperatura média e tipo de clima predominante.",
  "diasRecomendados": "X a Y dias",
  "locaisParaVisitar": [
    {
      "nome": "Nome real e completo do local",
      "descricao": "Descrição em até 15 palavras",
      "categoria": "monumento | museu | parque | praia | mirante | centro histórico",
      "avaliacao": 4.7,
      "palavraChaveImagem": "Nome Exato do Local Nome da Cidade"
    }
  ],
  "ondeJantar": [
    {
      "nome": "Nome REAL e COMPLETO do restaurante (que existe de verdade)",
      "descricao": "Descrição curta",
      "tipoCozinha": "Tipo de cozinha",
      "faixaPreco": "$$ | $$$ | $$$$",
      "palavraChaveImagem": "Nome Exato do Restaurante Nome da Cidade"
    }
  ],
  "experiencias": [
    {
      "nome": "Nome da experiência",
      "descricao": "Descrição curta",
      "tipo": "aventura | cultural | gastronômica | natureza | passeio",
      "palavraChaveImagem": "Local Principal da Experiência Nome da Cidade"
    }
  ],
  "dicas": ["Dica prática e útil"],
  "avisoConfiabilidade": ""
}

Quantidades:
- locaisParaVisitar: 5 a 6 itens
- ondeJantar: 3 a 4 itens
- experiencias: 3 a 4 itens
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

    const [locaisComImagem, jantarComImagem, experienciasComImagem] = await Promise.all([
      buscarImagensParaLista(dados.locaisParaVisitar || [], cidadeNome, 'local'),
      buscarImagensParaLista(dados.ondeJantar || [], cidadeNome, 'restaurante'),
      buscarImagensParaLista(dados.experiencias || [], cidadeNome, 'local'),
    ]);

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

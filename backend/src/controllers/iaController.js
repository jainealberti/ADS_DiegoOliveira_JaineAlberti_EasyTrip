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

module.exports = { gerarPreferenciasPorCidade, chatIA };

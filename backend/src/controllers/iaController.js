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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Retorne APENAS um JSON válido, sem markdown, sem blocos de código.\n\nGere 10 preferências/experiências de viagem específicas e contextualizadas para a cidade de ${cidade}. Cada preferência deve ser algo típico ou recomendado para quem visita essa cidade. Retorne JSON: { "preferencias": [ { "id": "slug_unico", "nome": "Nome curto" } ] }`;

    const resultado = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 500 }
    });

    const conteudo = resultado.response.text().trim();
    const jsonLimpo = conteudo.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const dados = JSON.parse(jsonLimpo);
    res.json({ preferencias: dados.preferencias || [] });
  } catch (erro) {
    console.error('Erro ao gerar preferências:', erro.message);
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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let systemMsg = 'Você é um assistente de viagens simpático e prestativo chamado EasyTrip. Responda em português do Brasil. Seja conciso mas informativo. Use emojis quando apropriado.';

    if (contexto?.cidade) {
      systemMsg += ` O usuário está planejando ou viajando para ${contexto.cidade}.`;
    }
    if (contexto?.destino) {
      systemMsg += ` Destino atual: ${contexto.destino}.`;
    }

    const resultado = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: systemMsg + '\n\n' + mensagem }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 1000 }
    });

    res.json({ resposta: resultado.response.text().trim() });
  } catch (erro) {
    console.error('Erro no chat IA:', erro.message);
    res.status(500).json({ mensagem: 'Erro ao processar mensagem.' });
  }
};

module.exports = { gerarPreferenciasPorCidade, chatIA };

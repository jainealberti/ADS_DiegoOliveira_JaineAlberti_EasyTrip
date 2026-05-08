const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function montarPromptRoteiro(dadosViagem, lugaresReais) {
  const lugaresJSON = lugaresReais.map(l => ({
    placeId: l.id,
    name: l.name,
    type: l.type,
    category: l.category,
    address: l.address || 'Endereço não disponível',
    latitude: l.latitude,
    longitude: l.longitude,
    description: l.description || '',
    cuisine: l.cuisine || null,
    openingHours: l.openingHours || null,
    fee: l.fee || null,
  }));

  return `Você é um planejador de viagens profissional.

Monte um roteiro personalizado usando SOMENTE os lugares reais fornecidos abaixo.

REGRAS OBRIGATÓRIAS:
- NÃO invente lugares.
- NÃO invente restaurantes.
- NÃO invente atrações.
- Use APENAS os placeIds fornecidos na lista abaixo.
- Organize os lugares por proximidade geográfica.
- Considere as preferências do usuário.
- Considere o transporte disponível.
- Considere o orçamento informado.
- Distribua as atividades equilibradamente entre os dias.
- Inclua refeições (café da manhã, almoço e jantar) usando restaurantes/cafés da lista.
- Sugira horários realistas para cada atividade.
- ESTIME CUSTOS REALISTAS para cada atividade em reais (R$).
- Retorne APENAS JSON válido, sem texto adicional.

REGRAS PARA ESTIMATIVA DE CUSTOS (estimatedCost em R$):
- Museus e atrações turísticas: geralmente R$ 20 a R$ 80 (ingressos)
- Parques públicos e praças: R$ 0 (gratuito)
- Parques temáticos e ecoparques: R$ 40 a R$ 120
- Restaurantes (café da manhã): R$ 20 a R$ 45
- Restaurantes (almoço): R$ 40 a R$ 90
- Restaurantes (jantar): R$ 50 a R$ 120
- Bares e pubs: R$ 30 a R$ 80
- Cafés e sorveterias: R$ 15 a R$ 35
- Igrejas, monumentos e memoriais: R$ 0 (gratuito)
- Mirantes: R$ 0 a R$ 20
- Teatros e shows: R$ 30 a R$ 100
- Use valores realistas para a cidade de ${dadosViagem.cidade}.

DADOS DO USUÁRIO:
- Cidade: ${dadosViagem.cidade}
- Dias: ${dadosViagem.dias}
- Preferências: ${dadosViagem.preferencias || 'Mix variado de cultura, gastronomia e turismo'}
- Transporte: ${dadosViagem.transporte || 'A pé e transporte público'}
- Orçamento: ${dadosViagem.orcamento ? 'R$ ' + dadosViagem.orcamento + ' total' : 'Flexível'}
- Detalhes extras: ${dadosViagem.detalhesExtras || 'Nenhum'}

LUGARES REAIS DISPONÍVEIS (${lugaresJSON.length} lugares verificados do OpenStreetMap):
${JSON.stringify(lugaresJSON, null, 2)}

FORMATO DE RESPOSTA OBRIGATÓRIO:
{
  "overview": "Resumo criativo de 2-3 frases sobre o roteiro",
  "mensagem_pessoal": "Mensagem de boas-vindas mencionando a cidade e as preferências",
  "days": [
    {
      "day": 1,
      "title": "Título descritivo do dia",
      "activities": [
        {
          "placeId": "osm_node_123456",
          "name": "Nome exato do lugar (copiar da lista)",
          "type": "tipo do lugar",
          "suggestedTime": "09:00",
          "address": "Endereço do lugar",
          "description": "Descrição personalizada de por que visitar",
          "estimatedVisitDuration": "1h30",
          "estimatedCost": "45",
          "reason": "Motivo da sugestão baseado nas preferências",
          "latitude": -00.0000,
          "longitude": -00.0000
        }
      ]
    }
  ]
}

IMPORTANTE:
- Selecione de 5 a 7 atividades por dia.
- Cada "placeId" DEVE existir na lista fornecida.
- Copie name, latitude e longitude exatamente da lista.
- O campo "description" deve ser uma descrição personalizada para o viajante.
- O campo "reason" explica por que este lugar combina com as preferências.
- O campo "estimatedCost" deve ser um NÚMERO representando o valor em reais (sem R$, sem texto).`;
}

async function chamarGemini(prompt) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  for (const modelName of GEMINI_MODELS) {
    for (let tentativa = 1; tentativa <= MAX_RETRIES; tentativa++) {
      try {
        console.log(`[AIService] Tentativa ${tentativa}/${MAX_RETRIES} com modelo ${modelName}...`);

        const model = genAI.getGenerativeModel({ model: modelName });
        const resultado = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 16000,
            responseMimeType: 'application/json',
          },
        });

        const textoResposta = resultado.response.text();
        console.log(`[AIService] ${modelName} respondeu com ${textoResposta.length} caracteres`);
        return textoResposta;

      } catch (err) {
        const is503 = err.message?.includes('503');
        const is429 = err.message?.includes('429');
        const is404 = err.message?.includes('404');

        if (is404) {
          console.warn(`[AIService] Modelo ${modelName} não encontrado (404). Próximo modelo...`);
          break;
        }

        if ((is503 || is429) && tentativa < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * tentativa;
          console.warn(`[AIService] ${modelName} erro ${is503 ? '503' : '429'}. Aguardando ${delay / 1000}s...`);
          await sleep(delay);
          continue;
        }

        if (tentativa === MAX_RETRIES) {
          console.warn(`[AIService] ${modelName} falhou após ${MAX_RETRIES} tentativas. Próximo modelo...`);
          break;
        }

        throw err;
      }
    }
  }

  throw new Error('Todos os modelos Gemini falharam após múltiplas tentativas');
}

function extrairJSON(texto) {
  if (!texto || typeof texto !== 'string') return null;

  try {
    return JSON.parse(texto);
  } catch {}

  const semMarkdown = texto.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(semMarkdown);
  } catch {}

  const primeiraChave = texto.indexOf('{');
  const ultimaChave = texto.lastIndexOf('}');
  if (primeiraChave !== -1 && ultimaChave > primeiraChave) {
    try {
      return JSON.parse(texto.substring(primeiraChave, ultimaChave + 1));
    } catch {}
  }

  console.error('[AIService] Não foi possível extrair JSON da resposta');
  return null;
}

async function organizarRoteiro(dadosViagem, lugaresReais) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[AIService] GEMINI_API_KEY não configurada. Usando organização local.');
    return organizarRoteiroLocal(dadosViagem, lugaresReais);
  }

  try {
    const prompt = montarPromptRoteiro(dadosViagem, lugaresReais);
    const resposta = await chamarGemini(prompt);
    const json = extrairJSON(resposta);

    if (!json || !json.days || !Array.isArray(json.days)) {
      console.error('[AIService] Resposta do Gemini não contém "days" válido');
      return organizarRoteiroLocal(dadosViagem, lugaresReais);
    }

    return json;
  } catch (err) {
    console.error('[AIService] Erro ao chamar Gemini:', err.message);
    return organizarRoteiroLocal(dadosViagem, lugaresReais);
  }
}

function organizarRoteiroLocal(dadosViagem, lugaresReais) {
  const dias = parseInt(dadosViagem.dias) || 1;
  const atividadesPorDia = Math.min(Math.ceil(lugaresReais.length / dias), 7);

  const restaurantes = lugaresReais.filter(l =>
    l.category === 'gastronomia' || l.type === 'restaurante' || l.type === 'café'
  );
  const atracoes = lugaresReais.filter(l =>
    l.category !== 'gastronomia' && l.type !== 'restaurante' && l.type !== 'café'
  );

  const daysArray = [];
  let idxAtracao = 0;
  let idxRestaurante = 0;

  for (let dia = 1; dia <= dias; dia++) {
    const activities = [];

    if (restaurantes[idxRestaurante]) {
      activities.push(criarAtividade(restaurantes[idxRestaurante], '08:30', 'Café da manhã'));
      idxRestaurante++;
    }

    for (let i = 0; i < 3 && idxAtracao < atracoes.length; i++) {
      const horarios = ['10:00', '11:30', '14:00'];
      activities.push(criarAtividade(atracoes[idxAtracao], horarios[i], 'Passeio'));
      idxAtracao++;
    }

    if (restaurantes[idxRestaurante]) {
      activities.push(criarAtividade(restaurantes[idxRestaurante], '12:30', 'Almoço'));
      idxRestaurante++;
    }

    for (let i = 0; i < 2 && idxAtracao < atracoes.length; i++) {
      const horarios = ['15:30', '17:00'];
      activities.push(criarAtividade(atracoes[idxAtracao], horarios[i], 'Passeio da tarde'));
      idxAtracao++;
    }

    if (restaurantes[idxRestaurante]) {
      activities.push(criarAtividade(restaurantes[idxRestaurante], '19:30', 'Jantar'));
      idxRestaurante++;
    }

    daysArray.push({
      day: dia,
      title: `Dia ${dia} - Explorando ${dadosViagem.cidade}`,
      activities,
    });
  }

  return {
    overview: `Roteiro de ${dias} dia(s) em ${dadosViagem.cidade} com ${lugaresReais.length} lugares reais verificados.`,
    mensagem_pessoal: `Preparamos um roteiro especial para sua viagem a ${dadosViagem.cidade}!`,
    days: daysArray,
  };
}

function estimarCusto(lugar, motivo) {
  const tipo = lugar.type?.toLowerCase() || '';
  const categoria = lugar.category?.toLowerCase() || '';
  const fee = lugar.fee;

  if (fee === 'no' || fee === 'free') return '0';

  if (categoria === 'gastronomia' || tipo === 'restaurante' || tipo === 'café' || tipo === 'fast food') {
    if (motivo.includes('Café')) return String(Math.floor(Math.random() * 15) + 20);
    if (motivo.includes('Almoço')) return String(Math.floor(Math.random() * 30) + 45);
    if (motivo.includes('Jantar')) return String(Math.floor(Math.random() * 40) + 55);
    return String(Math.floor(Math.random() * 20) + 30);
  }
  if (tipo === 'bar' || tipo === 'pub') return String(Math.floor(Math.random() * 30) + 35);
  if (tipo === 'sorveteria') return String(Math.floor(Math.random() * 10) + 15);
  if (tipo === 'museu') return String(Math.floor(Math.random() * 30) + 25);
  if (tipo === 'atração') return String(Math.floor(Math.random() * 40) + 30);
  if (tipo === 'teatro') return String(Math.floor(Math.random() * 40) + 40);
  if (tipo === 'parque' || tipo === 'jardim') return '0';
  if (tipo === 'mirante') return String(Math.floor(Math.random() * 15));
  if (tipo === 'monumento' || tipo === 'memorial' || tipo === 'templo/igreja') return '0';
  if (tipo === 'centro cultural' || tipo === 'galeria') return String(Math.floor(Math.random() * 20) + 10);

  return '0';
}

function criarAtividade(lugar, horario, motivo) {
  return {
    placeId: lugar.id,
    name: lugar.name,
    type: lugar.type,
    suggestedTime: horario,
    address: lugar.address || '',
    description: lugar.description || `${lugar.type} em ${lugar.name}`,
    estimatedVisitDuration: lugar.category === 'gastronomia' ? '1h' : '1h30',
    estimatedCost: estimarCusto(lugar, motivo),
    reason: motivo,
    latitude: lugar.latitude,
    longitude: lugar.longitude,
  };
}

module.exports = { organizarRoteiro, organizarRoteiroLocal, chamarGemini, extrairJSON };

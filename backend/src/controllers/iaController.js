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

const FALLBACK_LOCAIS_POR_DESTINO = {
  'rio de janeiro': {
    locais: [
      { nome: 'Cristo Redentor', descricao: 'Estátua icônica no topo do Corcovado com vista panorâmica', categoria: 'monumento', avaliacao: 4.8, palavraChaveImagem: 'Cristo Redentor' },
      { nome: 'Pão de Açúcar', descricao: 'Bondinho sobre a Baía de Guanabara com vista deslumbrante', categoria: 'mirante', avaliacao: 4.7, palavraChaveImagem: 'Pão de Açúcar Rio de Janeiro' },
      { nome: 'Praia de Copacabana', descricao: 'A praia mais famosa do Brasil com calçadão icônico', categoria: 'praia', avaliacao: 4.5, palavraChaveImagem: 'Copacabana' },
      { nome: 'Jardim Botânico do Rio de Janeiro', descricao: 'Palmeiras imperiais e flora tropical em área preservada', categoria: 'parque', avaliacao: 4.6, palavraChaveImagem: 'Jardim Botânico do Rio de Janeiro' },
      { nome: 'Museu do Amanhã', descricao: 'Museu interativo de ciência e sustentabilidade na Praça Mauá', categoria: 'museu', avaliacao: 4.5, palavraChaveImagem: 'Museu do Amanhã' },
    ],
    restaurantes: [
      { nome: 'Confeitaria Colombo', descricao: 'Confeitaria histórica de 1894 com arquitetura art nouveau', tipoCozinha: 'Confeitaria', faixaPreco: '$$', palavraChaveImagem: 'Confeitaria Colombo' },
      { nome: 'Restaurante Aprazível', descricao: 'Culinária brasileira contemporânea em Santa Teresa', tipoCozinha: 'Brasileira', faixaPreco: '$$$', palavraChaveImagem: 'Aprazível restaurante Santa Teresa' },
      { nome: 'Bar Urca', descricao: 'Petiscos e chopp com vista para a Baía de Guanabara', tipoCozinha: 'Petiscos', faixaPreco: '$$', palavraChaveImagem: 'Bar Urca Rio de Janeiro' },
    ],
    experiencias: [
      { nome: 'Trilha da Pedra Bonita', descricao: 'Caminhada com vista panorâmica da Zona Sul carioca', tipo: 'natureza', palavraChaveImagem: 'Pedra Bonita Rio de Janeiro' },
      { nome: 'Escadaria Selarón', descricao: 'Escadaria artística com azulejos coloridos na Lapa', tipo: 'cultural', palavraChaveImagem: 'Escadaria Selarón' },
      { nome: 'Feira de São Cristóvão', descricao: 'Cultura nordestina com música, comida e artesanato', tipo: 'cultural', palavraChaveImagem: 'Feira de São Cristóvão' },
    ],
  },
  'são paulo': {
    locais: [
      { nome: 'Parque Ibirapuera', descricao: 'Principal parque urbano com museus e áreas verdes', categoria: 'parque', avaliacao: 4.7, palavraChaveImagem: 'Parque Ibirapuera' },
      { nome: 'Avenida Paulista', descricao: 'Principal avenida da cidade com centros culturais', categoria: 'centro histórico', avaliacao: 4.5, palavraChaveImagem: 'Avenida Paulista' },
      { nome: 'MASP', descricao: 'Museu de Arte de São Paulo com acervo internacional', categoria: 'museu', avaliacao: 4.6, palavraChaveImagem: 'Museu de Arte de São Paulo' },
      { nome: 'Catedral da Sé', descricao: 'Catedral neogótica no centro histórico da cidade', categoria: 'igreja', avaliacao: 4.4, palavraChaveImagem: 'Catedral da Sé São Paulo' },
      { nome: 'Pinacoteca do Estado de São Paulo', descricao: 'Museu de arte mais antigo da cidade, no Jardim da Luz', categoria: 'museu', avaliacao: 4.6, palavraChaveImagem: 'Pinacoteca do Estado de São Paulo' },
    ],
    restaurantes: [
      { nome: 'Mercado Municipal de São Paulo', descricao: 'Mercadão com mortadela, pastel e frutas tropicais', tipoCozinha: 'Mercado', faixaPreco: '$$', palavraChaveImagem: 'Mercado Municipal de São Paulo' },
      { nome: 'A Casa do Porco', descricao: 'Um dos melhores restaurantes do mundo, especializado em porco', tipoCozinha: 'Brasileira', faixaPreco: '$$$', palavraChaveImagem: 'A Casa do Porco restaurante' },
      { nome: 'Bar da Dona Onça', descricao: 'Comida brasileira autêntica no Edifício Copan', tipoCozinha: 'Brasileira', faixaPreco: '$$', palavraChaveImagem: 'Edifício Copan São Paulo' },
    ],
    experiencias: [
      { nome: 'Beco do Batman', descricao: 'Galeria de grafite a céu aberto em Vila Madalena', tipo: 'cultural', palavraChaveImagem: 'Beco do Batman São Paulo' },
      { nome: 'Liberdade', descricao: 'Bairro japonês com culinária e cultura oriental', tipo: 'cultural', palavraChaveImagem: 'Bairro da Liberdade São Paulo' },
      { nome: 'Theatro Municipal de São Paulo', descricao: 'Ópera e espetáculos em edifício histórico de 1911', tipo: 'cultural', palavraChaveImagem: 'Theatro Municipal de São Paulo' },
    ],
  },
  'paris': {
    locais: [
      { nome: 'Torre Eiffel', descricao: 'Símbolo icônico de Paris com vista panorâmica da cidade', categoria: 'monumento', avaliacao: 4.7, palavraChaveImagem: 'Eiffel Tower' },
      { nome: 'Museu do Louvre', descricao: 'Maior museu de arte do mundo com a Mona Lisa', categoria: 'museu', avaliacao: 4.8, palavraChaveImagem: 'Louvre Museum' },
      { nome: 'Catedral de Notre-Dame', descricao: 'Catedral gótica medieval na Île de la Cité', categoria: 'igreja', avaliacao: 4.7, palavraChaveImagem: 'Notre-Dame de Paris' },
      { nome: 'Arco do Triunfo', descricao: 'Monumento histórico no final da Champs-Élysées', categoria: 'monumento', avaliacao: 4.6, palavraChaveImagem: 'Arc de Triomphe' },
      { nome: 'Sacré-Cœur', descricao: 'Basílica no topo de Montmartre com vista de Paris', categoria: 'igreja', avaliacao: 4.6, palavraChaveImagem: 'Basilique du Sacré-Cœur' },
    ],
    restaurantes: [
      { nome: 'Le Bouillon Chartier', descricao: 'Restaurante histórico de 1896 com preços acessíveis', tipoCozinha: 'Francesa', faixaPreco: '$$', palavraChaveImagem: 'Bouillon Chartier Paris' },
      { nome: 'Café de Flore', descricao: 'Café icônico em Saint-Germain-des-Prés', tipoCozinha: 'Café', faixaPreco: '$$$', palavraChaveImagem: 'Café de Flore' },
      { nome: 'Le Comptoir du Panthéon', descricao: 'Bistrô francês clássico no Quartier Latin', tipoCozinha: 'Bistrô', faixaPreco: '$$', palavraChaveImagem: 'Panthéon Paris' },
    ],
    experiencias: [
      { nome: 'Cruzeiro pelo Rio Sena', descricao: 'Passeio de barco pelos principais monumentos de Paris', tipo: 'passeio', palavraChaveImagem: 'Seine river cruise Paris' },
      { nome: 'Jardim de Luxemburgo', descricao: 'Jardim elegante no coração do Quartier Latin', tipo: 'natureza', palavraChaveImagem: 'Jardin du Luxembourg' },
      { nome: 'Montmartre', descricao: 'Bairro boêmio com artistas, cafés e vista panorâmica', tipo: 'cultural', palavraChaveImagem: 'Montmartre Paris' },
    ],
  },
  'roma': {
    locais: [
      { nome: 'Coliseu', descricao: 'Anfiteatro romano do século I, ícone de Roma', categoria: 'monumento', avaliacao: 4.8, palavraChaveImagem: 'Colosseum' },
      { nome: 'Vaticano', descricao: 'Menor país do mundo com a Capela Sistina e Basílica', categoria: 'monumento', avaliacao: 4.9, palavraChaveImagem: 'Vatican City' },
      { nome: 'Fontana di Trevi', descricao: 'Fonte barroca mais famosa do mundo no coração de Roma', categoria: 'monumento', avaliacao: 4.7, palavraChaveImagem: 'Trevi Fountain' },
      { nome: 'Panteão', descricao: 'Templo romano com a maior cúpula de concreto não armado', categoria: 'monumento', avaliacao: 4.8, palavraChaveImagem: 'Pantheon Rome' },
      { nome: 'Fórum Romano', descricao: 'Ruínas do centro político da Roma Antiga', categoria: 'monumento', avaliacao: 4.6, palavraChaveImagem: 'Roman Forum' },
    ],
    restaurantes: [
      { nome: 'Da Enzo al 29', descricao: 'Trattoria autêntica no bairro Trastevere', tipoCozinha: 'Italiana', faixaPreco: '$$', palavraChaveImagem: 'Trastevere Roma' },
      { nome: 'Roscioli', descricao: 'Restaurante e deli com massas e vinhos italianos', tipoCozinha: 'Italiana', faixaPreco: '$$$', palavraChaveImagem: 'Roscioli Roma restaurant' },
      { nome: 'Pizzarium', descricao: 'Pizza al taglio premiada do chef Gabriele Bonci', tipoCozinha: 'Pizza', faixaPreco: '$', palavraChaveImagem: 'Pizzarium Roma' },
    ],
    experiencias: [
      { nome: 'Trastevere à noite', descricao: 'Passeio pelo bairro mais charmoso de Roma', tipo: 'cultural', palavraChaveImagem: 'Trastevere Rome' },
      { nome: 'Villa Borghese', descricao: 'Jardins e galeria de arte renascentista', tipo: 'natureza', palavraChaveImagem: 'Villa Borghese' },
      { nome: 'Via Appia Antica', descricao: 'Caminhada pela estrada romana milenar com catacumbas', tipo: 'aventura', palavraChaveImagem: 'Appian Way Rome' },
    ],
  },
  'gramado': {
    locais: [
      { nome: 'Lago Negro', descricao: 'Lago cercado por hortênsias e araucárias no centro', categoria: 'parque', avaliacao: 4.6, palavraChaveImagem: 'Lago Negro Gramado' },
      { nome: 'Mini Mundo', descricao: 'Parque temático com miniaturas de construções famosas', categoria: 'parque', avaliacao: 4.5, palavraChaveImagem: 'Mini Mundo Gramado' },
      { nome: 'Igreja Matriz São Pedro', descricao: 'Igreja de pedra basáltica na Praça das Etnias', categoria: 'igreja', avaliacao: 4.5, palavraChaveImagem: 'Igreja Matriz São Pedro Gramado' },
      { nome: 'Rua Coberta', descricao: 'Rua coberta com restaurantes, lojas e eventos', categoria: 'centro histórico', avaliacao: 4.4, palavraChaveImagem: 'Rua Coberta Gramado' },
    ],
    restaurantes: [
      { nome: 'Colosseo', descricao: 'Restaurante italiano tradicional na Avenida Borges', tipoCozinha: 'Italiana', faixaPreco: '$$$', palavraChaveImagem: 'Colosseo Restaurante Gramado' },
      { nome: 'Chocolates Prawer', descricao: 'Fábrica e loja de chocolates artesanais', tipoCozinha: 'Chocolateria', faixaPreco: '$$', palavraChaveImagem: 'Chocolates Prawer Gramado' },
      { nome: 'Café Colonial Bela Vista', descricao: 'Café colonial típico da Serra Gaúcha', tipoCozinha: 'Café Colonial', faixaPreco: '$$', palavraChaveImagem: 'Café Colonial Bela Vista Gramado' },
    ],
    experiencias: [
      { nome: 'Snowland', descricao: 'Parque de neve indoor com esqui e snowboard', tipo: 'aventura', palavraChaveImagem: 'Snowland Gramado' },
      { nome: 'Natal Luz', descricao: 'Festival natalino com espetáculos e decoração', tipo: 'cultural', palavraChaveImagem: 'Natal Luz Gramado' },
      { nome: 'Vale do Quilombo', descricao: 'Mirante natural com vista do vale e cachoeiras', tipo: 'natureza', palavraChaveImagem: 'Vale do Quilombo Gramado' },
    ],
  },
  'salvador': {
    locais: [
      { nome: 'Pelourinho', descricao: 'Centro histórico colonial com casarões coloridos', categoria: 'centro histórico', avaliacao: 4.5, palavraChaveImagem: 'Pelourinho Salvador' },
      { nome: 'Elevador Lacerda', descricao: 'Elevador art déco ligando Cidade Alta e Baixa', categoria: 'monumento', avaliacao: 4.4, palavraChaveImagem: 'Elevador Lacerda' },
      { nome: 'Farol da Barra', descricao: 'Farol histórico na ponta da praia da Barra', categoria: 'monumento', avaliacao: 4.6, palavraChaveImagem: 'Farol da Barra Salvador' },
      { nome: 'Igreja e Convento de São Francisco', descricao: 'Obra-prima do barroco brasileiro com ouro', categoria: 'igreja', avaliacao: 4.7, palavraChaveImagem: 'Igreja de São Francisco Salvador' },
    ],
    restaurantes: [
      { nome: 'Acarajé da Dinha', descricao: 'Acarajé tradicional baiano no Rio Vermelho', tipoCozinha: 'Baiana', faixaPreco: '$', palavraChaveImagem: 'Acarajé da Dinha Salvador' },
      { nome: 'Restaurante Yemanjá', descricao: 'Frutos do mar e culinária baiana autêntica', tipoCozinha: 'Baiana', faixaPreco: '$$$', palavraChaveImagem: 'Restaurante Yemanjá Salvador' },
      { nome: 'Mercado Modelo', descricao: 'Artesanato e comida baiana em mercado histórico', tipoCozinha: 'Regional', faixaPreco: '$$', palavraChaveImagem: 'Mercado Modelo Salvador' },
    ],
    experiencias: [
      { nome: 'Roda de capoeira', descricao: 'Assistir ou participar de capoeira no Terreiro de Jesus', tipo: 'cultural', palavraChaveImagem: 'Capoeira Salvador' },
      { nome: 'Praia do Porto da Barra', descricao: 'Praia urbana com águas calmas na Baía de Todos-os-Santos', tipo: 'natureza', palavraChaveImagem: 'Porto da Barra Salvador' },
      { nome: 'Passeio de escuna pela Baía', descricao: 'Tour de barco pelas ilhas da Baía de Todos-os-Santos', tipo: 'passeio', palavraChaveImagem: 'Baía de Todos os Santos' },
    ],
  },
  'foz do iguaçu': {
    locais: [
      { nome: 'Cataratas do Iguaçu', descricao: 'Uma das 7 maravilhas da natureza com 275 quedas', categoria: 'cachoeira', avaliacao: 4.9, palavraChaveImagem: 'Cataratas do Iguaçu' },
      { nome: 'Parque das Aves', descricao: 'Viveiros com aves tropicais brasileiras em mata nativa', categoria: 'parque', avaliacao: 4.7, palavraChaveImagem: 'Parque das Aves Foz do Iguaçu' },
      { nome: 'Itaipu Binacional', descricao: 'Maior usina hidrelétrica do mundo em geração', categoria: 'monumento', avaliacao: 4.6, palavraChaveImagem: 'Itaipu Dam' },
      { nome: 'Marco das Três Fronteiras', descricao: 'Ponto onde se encontram Brasil, Argentina e Paraguai', categoria: 'mirante', avaliacao: 4.3, palavraChaveImagem: 'Marco das Três Fronteiras' },
    ],
    restaurantes: [
      { nome: 'Restaurante Porto Canoas', descricao: 'Restaurante dentro do Parque Nacional do Iguaçu', tipoCozinha: 'Brasileira', faixaPreco: '$$$', palavraChaveImagem: 'Restaurante Porto Canoas Foz do Iguaçu' },
      { nome: 'Capitão Bar', descricao: 'Churrascaria e petiscos com música ao vivo', tipoCozinha: 'Churrascaria', faixaPreco: '$$', palavraChaveImagem: 'Capitão Bar Foz do Iguaçu' },
    ],
    experiencias: [
      { nome: 'Macuco Safari', descricao: 'Passeio de barco sob as cataratas com banho de cachoeira', tipo: 'aventura', palavraChaveImagem: 'Macuco Safari Iguaçu' },
      { nome: 'Cataratas lado argentino', descricao: 'Vista diferente das cataratas pelo Parque Nacional argentino', tipo: 'passeio', palavraChaveImagem: 'Iguazu Falls Argentina' },
      { nome: 'Compras em Ciudad del Este', descricao: 'Comércio popular no Paraguai a poucos km', tipo: 'passeio', palavraChaveImagem: 'Ciudad del Este' },
    ],
  },
  'lisboa': {
    locais: [
      { nome: 'Torre de Belém', descricao: 'Torre manuelina à beira do Tejo, patrimônio UNESCO', categoria: 'monumento', avaliacao: 4.5, palavraChaveImagem: 'Torre de Belém' },
      { nome: 'Mosteiro dos Jerónimos', descricao: 'Obra-prima da arquitetura manuelina em Belém', categoria: 'monumento', avaliacao: 4.7, palavraChaveImagem: 'Mosteiro dos Jerónimos' },
      { nome: 'Castelo de São Jorge', descricao: 'Castelo mourisco com vista panorâmica de Lisboa', categoria: 'monumento', avaliacao: 4.5, palavraChaveImagem: 'Castelo de São Jorge' },
      { nome: 'Praça do Comércio', descricao: 'Grande praça ribeirinha no coração da Baixa', categoria: 'praça', avaliacao: 4.5, palavraChaveImagem: 'Praça do Comércio Lisboa' },
      { nome: 'Oceanário de Lisboa', descricao: 'Segundo maior oceanário da Europa no Parque das Nações', categoria: 'museu', avaliacao: 4.7, palavraChaveImagem: 'Oceanário de Lisboa' },
    ],
    restaurantes: [
      { nome: 'Pastéis de Belém', descricao: 'Pastel de nata original desde 1837', tipoCozinha: 'Pastelaria', faixaPreco: '$', palavraChaveImagem: 'Pastéis de Belém' },
      { nome: 'Time Out Market', descricao: 'Mercado gastronômico com os melhores chefs de Lisboa', tipoCozinha: 'Variada', faixaPreco: '$$', palavraChaveImagem: 'Time Out Market Lisboa' },
      { nome: 'Cervejaria Ramiro', descricao: 'Marisqueira famosa com frutos do mar frescos', tipoCozinha: 'Marisqueira', faixaPreco: '$$$', palavraChaveImagem: 'Cervejaria Ramiro Lisboa' },
    ],
    experiencias: [
      { nome: 'Elétrico 28', descricao: 'Passeio de bonde pelas ruas históricas de Lisboa', tipo: 'passeio', palavraChaveImagem: 'Tram 28 Lisbon' },
      { nome: 'Alfama', descricao: 'Bairro medieval com fado, becos e miradouros', tipo: 'cultural', palavraChaveImagem: 'Alfama Lisbon' },
      { nome: 'Sintra', descricao: 'Palácios e castelos encantados nos arredores de Lisboa', tipo: 'passeio', palavraChaveImagem: 'Sintra Portugal' },
    ],
  },
  'nova york': {
    locais: [
      { nome: 'Estátua da Liberdade', descricao: 'Símbolo de liberdade e ícone dos Estados Unidos', categoria: 'monumento', avaliacao: 4.7, palavraChaveImagem: 'Statue of Liberty' },
      { nome: 'Central Park', descricao: 'Parque urbano icônico no coração de Manhattan', categoria: 'parque', avaliacao: 4.8, palavraChaveImagem: 'Central Park New York' },
      { nome: 'Times Square', descricao: 'Cruzamento mais movimentado do mundo com luzes neon', categoria: 'praça', avaliacao: 4.5, palavraChaveImagem: 'Times Square' },
      { nome: 'Empire State Building', descricao: 'Arranha-céu art déco com observatório panorâmico', categoria: 'mirante', avaliacao: 4.6, palavraChaveImagem: 'Empire State Building' },
      { nome: 'Metropolitan Museum of Art', descricao: 'Maior museu de arte dos EUA com 5.000 anos de arte', categoria: 'museu', avaliacao: 4.8, palavraChaveImagem: 'Metropolitan Museum of Art' },
    ],
    restaurantes: [
      { nome: 'Katz\'s Delicatessen', descricao: 'Deli histórica de 1888 com pastrami legendário', tipoCozinha: 'Deli', faixaPreco: '$$', palavraChaveImagem: 'Katz\'s Delicatessen New York' },
      { nome: 'Joe\'s Pizza', descricao: 'Pizza nova-iorquina clássica em Greenwich Village', tipoCozinha: 'Pizza', faixaPreco: '$', palavraChaveImagem: 'New York pizza' },
      { nome: 'Chelsea Market', descricao: 'Mercado gastronômico em antigo prédio industrial', tipoCozinha: 'Variada', faixaPreco: '$$', palavraChaveImagem: 'Chelsea Market New York' },
    ],
    experiencias: [
      { nome: 'Broadway', descricao: 'Assistir um musical nos teatros mais famosos do mundo', tipo: 'cultural', palavraChaveImagem: 'Broadway Theatre New York' },
      { nome: 'Brooklyn Bridge', descricao: 'Caminhada pela ponte histórica com vista de Manhattan', tipo: 'passeio', palavraChaveImagem: 'Brooklyn Bridge' },
      { nome: 'High Line', descricao: 'Parque linear elevado sobre antigos trilhos de trem', tipo: 'passeio', palavraChaveImagem: 'High Line New York' },
    ],
  },
};

async function gerarExploracaoFallback(destino) {
  const { buscarImagemCidade, buscarImagensParaLista } = require('../services/imageService');

  const destinoLower = destino.toLowerCase().trim();
  const fallbackConhecido = Object.keys(FALLBACK_LOCAIS_POR_DESTINO).find(
    k => destinoLower.includes(k) || k.includes(destinoLower)
  );

  let locais, restaurantes, experiencias;

  if (fallbackConhecido) {
    const dados = FALLBACK_LOCAIS_POR_DESTINO[fallbackConhecido];
    locais = dados.locais;
    restaurantes = dados.restaurantes;
    experiencias = dados.experiencias;
  } else {
    locais = [
      { nome: `Centro de ${destino}`, descricao: 'Explore o centro e a arquitetura local', categoria: 'centro histórico', avaliacao: 0, palavraChaveImagem: `Centro histórico ${destino}` },
      { nome: `Igreja principal de ${destino}`, descricao: 'Visite a igreja ou catedral mais importante', categoria: 'igreja', avaliacao: 0, palavraChaveImagem: `Igreja matriz ${destino}` },
      { nome: `Praça central de ${destino}`, descricao: 'Conheça a praça principal da cidade', categoria: 'praça', avaliacao: 0, palavraChaveImagem: `Praça central ${destino}` },
    ];

    restaurantes = [
      { nome: `Gastronomia local de ${destino}`, descricao: 'Pratos típicos e sabores regionais', tipoCozinha: 'Regional', faixaPreco: '$$', palavraChaveImagem: `Restaurante típico ${destino}` },
      { nome: `Mercado de ${destino}`, descricao: 'Mercado local com produtos frescos e típicos', tipoCozinha: 'Mercado', faixaPreco: '$', palavraChaveImagem: `Mercado municipal ${destino}` },
    ];

    experiencias = [
      { nome: `Passeio por ${destino}`, descricao: 'Caminhada pelos principais pontos da cidade', tipo: 'passeio', palavraChaveImagem: `Pontos turísticos ${destino}` },
      { nome: `Natureza em ${destino}`, descricao: 'Trilhas, parques e paisagens naturais', tipo: 'natureza', palavraChaveImagem: `Parque natural ${destino}` },
    ];
  }

  const headerImage = await buscarImagemCidade(destino);

  const locaisComImagem = await buscarImagensParaLista(locais, destino, 'local', headerImage);
  const jantarComImagem = await buscarImagensParaLista(restaurantes, destino, 'restaurante', headerImage, locaisComImagem);
  const experienciasComImagem = await buscarImagensParaLista(experiencias, destino, 'local', headerImage, locaisComImagem, jantarComImagem);

  return {
    destino: destino,
    pais: '',
    resumo: fallbackConhecido
      ? `${destino} é um destino incrível com atrações imperdíveis, gastronomia marcante e experiências únicas. Use nosso gerador de roteiros com IA para criar um plano completo e personalizado.`
      : `${destino} é um destino fascinante. Use nosso gerador de roteiros com IA para criar um plano completo e personalizado. Configure a GEMINI_API_KEY para obter informações detalhadas.`,
    melhorEpoca: 'Pesquise a sazonalidade do destino para escolher a melhor época.',
    clima: 'Consulte a previsão do tempo antes de viajar.',
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
    avisoConfiabilidade: fallbackConhecido
      ? ''
      : 'Não foi possível obter informações detalhadas pela IA. Configure a GEMINI_API_KEY para recomendações personalizadas.',
  };
}

const explorarDestino = async (req, res) => {
  console.log('[explorarDestino] Body recebido:', JSON.stringify(req.body));
  console.log('[explorarDestino] GEMINI_API_KEY presente?', !!process.env.GEMINI_API_KEY);

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
    console.log('[explorarDestino] Sem GEMINI_API_KEY, usando fallback direto');
    try {
      return res.json(await gerarExploracaoFallback(destinoLimpo));
    } catch (fallbackErro) {
      console.error('[explorarDestino] Fallback falhou (sem key):', fallbackErro.message, fallbackErro.stack);
      return res.status(500).json({
        error: {
          code: 'IA_UNAVAILABLE',
          message: 'Serviço de exploração temporariamente indisponível. Tente novamente.',
        },
      });
    }
  }

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const { buscarImagemCidade, buscarImagensParaLista } = require('../services/imageService');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('[explorarDestino] Chamando Gemini para:', destinoLimpo);

    const prompt = `Você é um guia de viagens especialista com conhecimento real e verificável. O usuário quer explorar: "${destinoLimpo}".

REGRAS OBRIGATÓRIAS:
- Responda em português do Brasil.
- Use APENAS informações reais e verificáveis. NUNCA invente nomes de lugares, restaurantes ou experiências.
- Todos os locais, restaurantes e experiências DEVEM ser reais, existentes e verificáveis no Google Maps.
- Para cidades brasileiras, SEMPRE inclua o estado no campo "destino" (ex: "Cunha, São Paulo", "Monte Sião, Minas Gerais").
- Para cidades internacionais, inclua o país (ex: "Hallstatt, Áustria").

REGRAS CRÍTICAS PARA FOTOS (palavraChaveImagem):
- O campo "palavraChaveImagem" é FUNDAMENTAL para buscar fotos reais do local.
- Para locais turísticos: use o NOME OFICIAL COMPLETO como aparece na Wikipedia. Exemplos:
  - "Cristo Redentor" (não "cristo" nem "estátua do cristo")
  - "Parque Ibirapuera" (não "parque em SP")
  - "Cataratas do Iguaçu" (não "cachoeira")
  - "Torre Eiffel" ou "Eiffel Tower"
  - "Colosseum" ou "Coliseu de Roma"
- Para restaurantes: use o NOME REAL DO RESTAURANTE + CIDADE. Se não souber o nome exato, use um prato típico + cidade. Exemplos:
  - "Confeitaria Colombo Rio de Janeiro"
  - "Pastéis de Belém Lisboa"
  - "Mercado Municipal de São Paulo"
- Para experiências: use o NOME DO LOCAL PRINCIPAL da experiência. Exemplos:
  - "Escadaria Selarón"
  - "Brooklyn Bridge"
  - "Trastevere Rome"
- NUNCA use palavras genéricas como "restaurant", "food", "tourism", "landmark" como palavraChaveImagem.
- Se for um local pouco conhecido, adicione a cidade ao final: "Praça da Matriz Cunha"

- Descrições devem ter no máximo 15 palavras cada.

REGRAS PARA CIDADES PEQUENAS:
- Se a cidade for pequena, NÃO invente locais. É MELHOR retornar menos itens com informações reais.
- Priorize: praças centrais, igrejas históricas, cachoeiras, mirantes, restaurantes conhecidos.
- Se não tem certeza se um local existe, NÃO inclua.

Retorne JSON com esta estrutura exata:
{
  "destino": "Nome completo da cidade, Estado/País",
  "pais": "País",
  "estado": "Estado/província (se aplicável)",
  "resumo": "3-4 frases descritivas sobre o destino.",
  "melhorEpoca": "Período recomendado e motivo.",
  "clima": "Temperatura média e tipo de clima.",
  "diasRecomendados": "X a Y dias",
  "locaisParaVisitar": [
    {
      "nome": "Nome real e completo do local",
      "descricao": "Descrição em até 15 palavras",
      "categoria": "monumento | museu | parque | praia | mirante | centro histórico | igreja | cachoeira | praça",
      "avaliacao": 4.7,
      "palavraChaveImagem": "Nome Oficial do Local (exatamente como na Wikipedia)"
    }
  ],
  "ondeJantar": [
    {
      "nome": "Nome REAL do restaurante",
      "descricao": "Descrição curta",
      "tipoCozinha": "Tipo de cozinha",
      "faixaPreco": "$$ | $$$ | $$$$",
      "palavraChaveImagem": "Nome Real do Restaurante Cidade"
    }
  ],
  "experiencias": [
    {
      "nome": "Nome da experiência",
      "descricao": "Descrição curta",
      "tipo": "aventura | cultural | gastronômica | natureza | passeio",
      "palavraChaveImagem": "Nome do Local Principal da Experiência"
    }
  ],
  "dicas": ["Dica prática"],
  "avisoConfiabilidade": ""
}

Quantidades:
- Cidades grandes: locaisParaVisitar: 5-6, ondeJantar: 3-4, experiencias: 3-4
- Cidades pequenas: locaisParaVisitar: 2-4, ondeJantar: 2-3, experiencias: 2-3
- dicas: 3 a 5 itens
- avaliacao: número entre 3.0 e 5.0 com uma casa decimal`;

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
        try {
          return res.json(await gerarExploracaoFallback(destinoLimpo));
        } catch (fallbackErro) {
          console.error('[explorarDestino] Fallback falhou (JSON inválido):', fallbackErro.message, fallbackErro.stack);
          return res.status(500).json({
            error: {
              code: 'IA_UNAVAILABLE',
              message: 'Serviço de exploração temporariamente indisponível. Tente novamente.',
            },
          });
        }
      }
    }

    const cidadeNome = dados.destino || destinoLimpo;
    console.log('[explorarDestino] Gemini respondeu com sucesso, enriquecendo imagens para:', cidadeNome);

    const headerImage = await buscarImagemCidade(cidadeNome);

    const locaisComImagem = await buscarImagensParaLista(dados.locaisParaVisitar || [], cidadeNome, 'local', headerImage);
    const jantarComImagem = await buscarImagensParaLista(dados.ondeJantar || [], cidadeNome, 'restaurante', headerImage, locaisComImagem);
    const experienciasComImagem = await buscarImagensParaLista(dados.experiencias || [], cidadeNome, 'local', headerImage, locaisComImagem, jantarComImagem);

    console.log('[explorarDestino] Resposta pronta para:', cidadeNome);
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
    console.error('[explorarDestino] Erro principal:', erro.message, erro.stack);
    try {
      res.json(await gerarExploracaoFallback(destinoLimpo));
    } catch (fallbackErro) {
      console.error('[explorarDestino] Fallback também falhou:', fallbackErro.message, fallbackErro.stack);
      res.status(500).json({
        error: {
          code: 'IA_UNAVAILABLE',
          message: 'Não foi possível explorar o destino. Tente novamente mais tarde.',
        },
      });
    }
  }
};

module.exports = { gerarPreferenciasPorCidade, chatIA, explorarDestino };

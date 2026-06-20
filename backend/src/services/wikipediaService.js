const WIKIPEDIA_API = 'https://pt.wikipedia.org/w/api.php';
const WIKIPEDIA_EN_API = 'https://en.wikipedia.org/w/api.php';

let ultimaChamadaWiki = 0;
const MIN_INTERVALO_MS = 350;

async function chamarWikiAPI(url, tentativa = 1) {
  const agora = Date.now();
  const espera = MIN_INTERVALO_MS - (agora - ultimaChamadaWiki);
  if (espera > 0) await sleep(espera);
  ultimaChamadaWiki = Date.now();

  const resp = await fetch(url, {
    headers: { 'User-Agent': 'EasyTrip/1.0 (academic-project; travel-planner)' }
  });

  if (resp.status === 429) {
    if (tentativa <= 2) {
      await sleep(2000 * tentativa);
      return chamarWikiAPI(url, tentativa + 1);
    }
    throw new Error('Wikipedia rate limit persistente');
  }

  if (!resp.ok) {
    throw new Error(`Wikipedia retornou status ${resp.status}`);
  }

  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    if (text.includes('rate') || text.includes('You are ma')) {
      if (tentativa <= 2) {
        await sleep(2000 * tentativa);
        return chamarWikiAPI(url, tentativa + 1);
      }
      throw new Error('Wikipedia rate limit');
    }
    throw new Error('JSON inválido da Wikipedia');
  }
}

function ehPaginaDeCidade(titulo, snippet) {
  const texto = `${titulo} ${snippet || ''}`.toLowerCase();
  const termosCidade = [
    'município', 'cidade', 'localidade', 'district', 'town', 'city',
    'village', 'municipality', 'habitantes', 'população', 'censo',
    'ibge', 'fundada em', 'fundado em', 'emancipação',
    'estado de', 'mesorregião', 'microrregião',
    'são paulo', 'minas gerais', 'rio de janeiro', 'bahia',
    'paraná', 'santa catarina', 'goiás', 'ceará', 'pernambuco',
    'rio grande do sul', 'rio grande do norte', 'alagoas', 'sergipe',
    'maranhão', 'piauí', 'mato grosso', 'espírito santo',
  ];
  return termosCidade.some(t => texto.includes(t));
}

function ehPaginaDePontoTuristico(titulo, snippet) {
  const texto = `${titulo} ${snippet || ''}`.toLowerCase();
  const termos = [
    'monumento', 'museu', 'parque', 'praça', 'igreja', 'catedral',
    'mercado', 'praia', 'cachoeira', 'mirante', 'teatro', 'palácio',
    'forte', 'farol', 'jardim', 'memorial', 'estátua', 'ponte',
    'inaugurad', 'construíd', 'fundad', 'localizad', 'situad',
    'patrimônio', 'tombad', 'atração', 'turístic',
  ];
  return termos.some(t => texto.includes(t));
}

async function buscarPagina(termo, apiBase, seletor) {
  try {
    const searchUrl = `${apiBase}?action=query&list=search&srsearch=${encodeURIComponent(termo)}&format=json&srlimit=5&origin=*`;
    const searchData = await chamarWikiAPI(searchUrl);

    const results = searchData?.query?.search;
    if (!results || results.length === 0) return null;

    if (seletor && results.length > 1) {
      const preferido = results.find(r => seletor(r.title, r.snippet));
      if (preferido) return preferido.title;
    }

    return results[0].title;
  } catch (err) {
    console.warn('[WikipediaService] Busca falhou para:', termo, err.message);
    return null;
  }
}

async function obterImagemDaPagina(titulo, apiBase) {
  try {
    const url = `${apiBase}?action=query&titles=${encodeURIComponent(titulo)}&prop=pageimages&pithumbsize=800&format=json&origin=*`;
    const data = await chamarWikiAPI(url);

    const pages = data?.query?.pages;
    if (!pages) return null;

    const pageId = Object.keys(pages)[0];
    if (pageId === '-1') return null;

    const thumb = pages[pageId]?.thumbnail?.source;
    if (!thumb) return null;

    if (thumb.includes('.svg') || thumb.includes('logo') || thumb.includes('flag') || thumb.includes('Flag') || thumb.includes('coat_of_arms') || thumb.includes('Coat')) {
      return null;
    }

    return thumb;
  } catch {
    return null;
  }
}

async function obterResumoDaPagina(titulo, apiBase) {
  try {
    const url = `${apiBase}?action=query&titles=${encodeURIComponent(titulo)}&prop=extracts&exintro=true&explaintext=true&format=json&origin=*`;
    const data = await chamarWikiAPI(url);

    const pages = data?.query?.pages;
    if (!pages) return null;

    const pageId = Object.keys(pages)[0];
    if (pageId === '-1') return null;

    const extract = pages[pageId].extract;
    if (!extract || extract.length < 30) return null;

    const resumo = extract.length > 500
      ? extract.substring(0, 500).replace(/\s+\S*$/, '') + '...'
      : extract;

    const lang = apiBase.includes('pt.wikipedia') ? 'pt' : 'en';
    const wikiUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(titulo.replace(/ /g, '_'))}`;

    return { summary: resumo, wikipediaUrl: wikiUrl, title: titulo };
  } catch {
    return null;
  }
}

function construirConsultasCidade(cidade) {
  const consultas = [];
  const partes = cidade.split(',').map(p => p.trim());

  if (partes.length >= 2) {
    consultas.push(`${partes[0]} (${partes[1]})`);
    consultas.push(`${partes[0]} ${partes[1]} município`);
  }

  consultas.push(`${cidade} município`);
  consultas.push(`${cidade} cidade`);
  consultas.push(cidade);

  return consultas;
}

function construirConsultasLocal(nome, cidade) {
  const consultas = [];

  if (cidade) {
    consultas.push(`${nome} ${cidade}`);
    consultas.push(nome);
  } else {
    consultas.push(nome);
  }

  return consultas;
}

async function buscarImagemWikipedia(nome, cidade) {
  const queryPrincipal = cidade ? `${nome} ${cidade}` : nome;

  const tituloPT = await buscarPagina(queryPrincipal, WIKIPEDIA_API, ehPaginaDePontoTuristico);
  if (tituloPT) {
    const img = await obterImagemDaPagina(tituloPT, WIKIPEDIA_API);
    if (img) return img;
  }

  if (cidade) {
    const tituloSemCidade = await buscarPagina(nome, WIKIPEDIA_API, ehPaginaDePontoTuristico);
    if (tituloSemCidade && tituloSemCidade !== tituloPT) {
      const img = await obterImagemDaPagina(tituloSemCidade, WIKIPEDIA_API);
      if (img) return img;
    }
  }

  const tituloEN = await buscarPagina(queryPrincipal, WIKIPEDIA_EN_API, null);
  if (tituloEN) {
    const img = await obterImagemDaPagina(tituloEN, WIKIPEDIA_EN_API);
    if (img) return img;
  }

  return null;
}

async function buscarImagemCidadeWikipedia(cidade) {
  const consultas = construirConsultasCidade(cidade);

  for (const consulta of consultas) {
    const titulo = await buscarPagina(consulta, WIKIPEDIA_API, ehPaginaDeCidade);
    if (titulo) {
      const img = await obterImagemDaPagina(titulo, WIKIPEDIA_API);
      if (img) return img;
    }
  }

  for (const consulta of consultas) {
    const titulo = await buscarPagina(consulta, WIKIPEDIA_EN_API, ehPaginaDeCidade);
    if (titulo) {
      const img = await obterImagemDaPagina(titulo, WIKIPEDIA_EN_API);
      if (img) return img;
    }
  }

  return null;
}

async function buscarResumoWikipedia(termo, cidade) {
  const consultas = cidade
    ? construirConsultasCidade(`${termo} ${cidade}`)
    : construirConsultasCidade(termo);

  for (const consulta of consultas) {
    const titulo = await buscarPagina(consulta, WIKIPEDIA_API, ehPaginaDeCidade);
    if (titulo) {
      const resumo = await obterResumoDaPagina(titulo, WIKIPEDIA_API);
      if (resumo) return resumo;
    }
  }

  const tituloSimples = await buscarPagina(termo, WIKIPEDIA_API, null);
  if (tituloSimples) {
    const resumo = await obterResumoDaPagina(tituloSimples, WIKIPEDIA_API);
    if (resumo) return resumo;
  }

  const tituloEN = await buscarPagina(termo, WIKIPEDIA_EN_API, null);
  if (tituloEN) {
    const resumo = await obterResumoDaPagina(tituloEN, WIKIPEDIA_EN_API);
    if (resumo) return resumo;
  }

  return null;
}

async function buscarImagensCidade(cidade) {
  const resultado = { headerImage: null, locaisImages: {} };
  resultado.headerImage = await buscarImagemCidadeWikipedia(cidade);
  return resultado;
}

async function buscarImagensParaLocais(locais, cidade) {
  const resultados = [];
  for (const local of locais) {
    const img = await buscarImagemWikipedia(local.nome || local.name, cidade);
    resultados.push({ ...local, imageUrl: img || null });
  }
  return resultados;
}

async function enriquecerLugares(lugares, cidade, maxEnriquecimentos = 15) {
  const lugaresOrdenados = [...lugares].sort((a, b) => {
    const prioridade = { 'turismo': 1, 'cultural': 2, 'histórico': 3, 'natureza': 4 };
    return (prioridade[a.category] || 5) - (prioridade[b.category] || 5);
  });

  const paraEnriquecer = lugaresOrdenados.slice(0, maxEnriquecimentos);
  let enriquecidos = 0;

  for (const lugar of paraEnriquecer) {
    if (lugar.description && lugar.description.length > 50) continue;

    const info = await buscarResumoWikipedia(lugar.name, cidade);
    if (info) {
      lugar.description = info.summary;
      lugar.wikipediaUrl = info.wikipediaUrl;
      enriquecidos++;
    }
  }

  console.log(`[WikipediaService] Enriquecidos ${enriquecidos}/${paraEnriquecer.length} lugares`);
  return lugares;
}

async function buscarInfoCidade(cidade) {
  const info = await buscarResumoWikipedia(cidade, '');
  return info || { summary: '', wikipediaUrl: '', title: cidade };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  buscarResumoWikipedia,
  enriquecerLugares,
  buscarInfoCidade,
  buscarImagemWikipedia,
  buscarImagemCidadeWikipedia,
  buscarImagensCidade,
  buscarImagensParaLocais,
};

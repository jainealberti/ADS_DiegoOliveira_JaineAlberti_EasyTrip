const WIKIPEDIA_API = 'https://pt.wikipedia.org/w/api.php';
const WIKIPEDIA_EN_API = 'https://en.wikipedia.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

let ultimaChamadaWiki = 0;
const MIN_INTERVALO_MS = 600;

let circuitBreakerAberto = 0;
const CIRCUIT_BREAKER_DURACAO_MS = 60_000;

function wikiCircuitAberto() {
  if (!circuitBreakerAberto) return false;
  if (Date.now() - circuitBreakerAberto > CIRCUIT_BREAKER_DURACAO_MS) {
    circuitBreakerAberto = 0;
    console.log('[WikipediaService] Circuit breaker resetado');
    return false;
  }
  return true;
}

function abrirCircuitBreaker() {
  if (!circuitBreakerAberto) {
    circuitBreakerAberto = Date.now();
    console.warn('[WikipediaService] Circuit breaker ABERTO — Wikipedia em rate limit, pulando chamadas por 60s');
  }
}

const BLOCKED_IMAGE_PATTERNS = [
  '.svg', 'logo', 'Logo', 'flag', 'Flag', 'Bandeira', 'bandeira',
  'coat_of_arms', 'Coat', 'Brasão', 'brasão', 'escudo', 'Escudo',
  'selo', 'Selo', 'shield', 'Shield', 'emblem', 'Emblem',
  'map', 'Map', 'mapa', 'Mapa', 'diagram', 'Diagram',
  'chart', 'Chart', 'graph', 'Graph',
  'icon', 'Icon', 'ícone', 'symbol', 'Symbol', 'pictogram',
  'signature', 'Signature', 'assinatura', 'autograph',
  'Wikidata', 'Commons-logo', 'Wikimedia-logo', 'Wiki-logo',
  'Question_book', 'Edit-clear', 'Ambox', 'Crystal_',
  'Nuvola_', 'Gnome-', 'Gtk-', 'Farm-Fresh',
  'increase', 'decrease', 'steady', 'Steady',
  'Red_pog', 'Blue_pog', 'Green_pog',
  'Locator', 'locator', 'Location_dot', 'location_map',
  'Relief_Map', 'relief_map', 'Topographic', 'topographic',
  'Administrative', 'administrative', 'political_map',
  'Blank_map', 'blank_map', 'Outline_map',
  'No_image', 'no_image', 'Image_manquante', 'Sin_imagen',
  'Placeholder', 'placeholder', 'Replace_this',
  'Wappen', 'wappen', 'Blason', 'blason', 'Armoiries',
  'Stemma', 'stemma', 'Herb_', 'herb_', 'Coa_',
  'Census', 'census', 'Population', 'Demography',
  'Klimadiagramm', 'Climate', 'climate_chart',
];

async function chamarWikiAPI(url, tentativa = 1) {
  if (wikiCircuitAberto()) {
    throw new Error('Wikipedia circuit breaker aberto');
  }

  const agora = Date.now();
  const espera = MIN_INTERVALO_MS - (agora - ultimaChamadaWiki);
  if (espera > 0) await sleep(espera);
  ultimaChamadaWiki = Date.now();

  const resp = await fetch(url, {
    headers: { 'User-Agent': 'EasyTrip/1.0 (academic-project; travel-planner)' }
  });

  if (resp.status === 429) {
    if (tentativa === 1) {
      await sleep(2000);
      return chamarWikiAPI(url, 2);
    }
    abrirCircuitBreaker();
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
      abrirCircuitBreaker();
      throw new Error('Wikipedia rate limit');
    }
    throw new Error('JSON inválido da Wikipedia');
  }
}

function isImagemBloqueada(urlOuTitulo) {
  if (!urlOuTitulo) return true;
  return BLOCKED_IMAGE_PATTERNS.some(p => urlOuTitulo.includes(p));
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
    'restaurante', 'hotel', 'resort', 'pousada',
    'museum', 'park', 'church', 'cathedral', 'beach', 'waterfall',
    'monument', 'palace', 'castle', 'temple', 'bridge', 'tower',
    'garden', 'square', 'plaza', 'market', 'harbor', 'port',
  ];
  return termos.some(t => texto.includes(t));
}

function calcularRelevancia(titulo, snippet, termoBuscado) {
  const tituloLower = titulo.toLowerCase();
  const termoLower = termoBuscado.toLowerCase();
  const palavrasTermo = termoLower.split(/[\s,\-()]+/).filter(p => p.length > 2);

  let score = 0;

  if (tituloLower === termoLower) return 100;

  if (tituloLower.includes(termoLower)) score += 50;

  const palavrasNoTitulo = palavrasTermo.filter(p => tituloLower.includes(p));
  score += (palavrasNoTitulo.length / palavrasTermo.length) * 40;

  const snippetLower = (snippet || '').toLowerCase().replace(/<[^>]*>/g, '');
  const palavrasNoSnippet = palavrasTermo.filter(p => snippetLower.includes(p));
  score += (palavrasNoSnippet.length / palavrasTermo.length) * 10;

  return score;
}

async function buscarPagina(termo, apiBase, seletor) {
  try {
    const searchUrl = `${apiBase}?action=query&list=search&srsearch=${encodeURIComponent(termo)}&format=json&srlimit=8&origin=*`;
    const searchData = await chamarWikiAPI(searchUrl);

    const results = searchData?.query?.search;
    if (!results || results.length === 0) return null;

    if (seletor && results.length > 1) {
      const preferido = results.find(r => seletor(r.title, r.snippet));
      if (preferido) return preferido.title;
    }

    const comScore = results.map(r => ({
      ...r,
      relevancia: calcularRelevancia(r.title, r.snippet, termo),
    }));

    comScore.sort((a, b) => b.relevancia - a.relevancia);

    if (comScore[0].relevancia < 20) {
      console.warn(`[WikipediaService] Resultado pouco relevante para "${termo}": "${comScore[0].title}" (score: ${comScore[0].relevancia.toFixed(1)})`);
      return null;
    }

    return comScore[0].title;
  } catch (err) {
    console.warn('[WikipediaService] Busca falhou para:', termo, err.message);
    return null;
  }
}

async function obterImagemDaPagina(titulo, apiBase) {
  try {
    const url = `${apiBase}?action=query&titles=${encodeURIComponent(titulo)}&prop=pageimages&pithumbsize=1200&format=json&origin=*`;
    const data = await chamarWikiAPI(url);

    const pages = data?.query?.pages;
    if (!pages) return null;

    const pageId = Object.keys(pages)[0];
    if (pageId === '-1') return null;

    const thumb = pages[pageId]?.thumbnail?.source;
    if (!thumb) return null;

    if (isImagemBloqueada(thumb)) return null;

    return thumb;
  } catch {
    return null;
  }
}

async function obterImagensDaPagina(titulo, apiBase) {
  try {
    const url = `${apiBase}?action=query&titles=${encodeURIComponent(titulo)}&prop=images&imlimit=20&format=json&origin=*`;
    const data = await chamarWikiAPI(url);

    const pages = data?.query?.pages;
    if (!pages) return null;

    const pageId = Object.keys(pages)[0];
    if (pageId === '-1') return null;

    const images = pages[pageId]?.images;
    if (!images || images.length === 0) return null;

    const fotoCandidatas = images.filter(img => {
      const title = img.title || '';
      if (!title.match(/\.(jpg|jpeg|png)$/i)) return false;
      if (isImagemBloqueada(title)) return false;
      return true;
    });

    for (const img of fotoCandidatas.slice(0, 5)) {
      const infoUrl = `${apiBase}?action=query&titles=${encodeURIComponent(img.title)}&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1200&format=json&origin=*`;
      const infoData = await chamarWikiAPI(infoUrl);

      const infoPages = infoData?.query?.pages;
      if (!infoPages) continue;

      const infoPageId = Object.keys(infoPages)[0];
      if (infoPageId === '-1') continue;

      const info = infoPages[infoPageId]?.imageinfo?.[0];
      if (!info) continue;

      const mime = info.mime || '';
      if (!mime.startsWith('image/jpeg') && !mime.startsWith('image/png')) continue;

      if (info.width < 400 || info.height < 250) continue;

      const imgUrl = info.thumburl || info.url;
      if (imgUrl && !isImagemBloqueada(imgUrl)) return imgUrl;
    }

    return null;
  } catch {
    return null;
  }
}

function calcularRelevanciaImagem(tituloArquivo, queryOriginal) {
  const titulo = tituloArquivo.toLowerCase().replace(/^file:/i, '').replace(/\.(jpg|jpeg|png)$/i, '');
  const palavrasQuery = queryOriginal.toLowerCase().split(/[\s,\-()]+/).filter(p => p.length > 2);

  if (palavrasQuery.length === 0) return 0;

  const palavrasEncontradas = palavrasQuery.filter(p => titulo.includes(p));
  return palavrasEncontradas.length / palavrasQuery.length;
}

async function buscarImagemWikimediaCommons(query) {
  try {
    const searchUrl = `${COMMONS_API}?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=15&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1200&format=json&origin=*`;
    const data = await chamarWikiAPI(searchUrl);

    const pages = data?.query?.pages;
    if (!pages) return null;

    const candidatas = Object.values(pages)
      .filter(p => {
        const info = p.imageinfo?.[0];
        if (!info) return false;

        const mime = info.mime || '';
        if (!mime.startsWith('image/jpeg') && !mime.startsWith('image/png')) return false;

        const title = (p.title || '').toLowerCase();
        if (isImagemBloqueada(title)) return false;

        if (info.width < 500 || info.height < 300) return false;

        const ratio = info.width / info.height;
        if (ratio < 0.5 || ratio > 4) return false;

        return true;
      })
      .map(p => {
        const relevancia = calcularRelevanciaImagem(p.title, query);
        const info = p.imageinfo[0];
        const ratio = info.width / info.height;
        const ratioScore = 1 - Math.min(Math.abs(ratio - 1.5), 1);
        const scoreTotal = (relevancia * 0.7) + (ratioScore * 0.3);
        return { ...p, scoreTotal, relevancia };
      })
      .sort((a, b) => b.scoreTotal - a.scoreTotal);

    if (candidatas.length === 0) return null;

    if (candidatas[0].relevancia < 0.35) {
      console.warn(`[WikipediaService] Commons: nenhuma imagem relevante para "${query}" (melhor score: ${candidatas[0].relevancia.toFixed(2)}, titulo: "${candidatas[0].title}")`);
      return null;
    }

    const info = candidatas[0].imageinfo[0];
    return info.thumburl || info.url;
  } catch (err) {
    console.warn('[WikipediaService] Wikimedia Commons falhou:', err.message);
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

async function buscarImagemWikipedia(nome, cidade) {
  const queryPrincipal = cidade ? `${nome} ${cidade}` : nome;

  const tituloPT = await buscarPagina(queryPrincipal, WIKIPEDIA_API, ehPaginaDePontoTuristico);
  if (tituloPT) {
    const img = await obterImagemDaPagina(tituloPT, WIKIPEDIA_API);
    if (img) return img;

    const imgAlt = await obterImagensDaPagina(tituloPT, WIKIPEDIA_API);
    if (imgAlt) return imgAlt;
  }

  if (cidade) {
    const tituloSemCidade = await buscarPagina(nome, WIKIPEDIA_API, ehPaginaDePontoTuristico);
    if (tituloSemCidade && tituloSemCidade !== tituloPT) {
      const img = await obterImagemDaPagina(tituloSemCidade, WIKIPEDIA_API);
      if (img) return img;

      const imgAlt = await obterImagensDaPagina(tituloSemCidade, WIKIPEDIA_API);
      if (imgAlt) return imgAlt;
    }
  }

  const tituloEN = await buscarPagina(queryPrincipal, WIKIPEDIA_EN_API, null);
  if (tituloEN) {
    const img = await obterImagemDaPagina(tituloEN, WIKIPEDIA_EN_API);
    if (img) return img;

    const imgAlt = await obterImagensDaPagina(tituloEN, WIKIPEDIA_EN_API);
    if (imgAlt) return imgAlt;
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

      const imgAlt = await obterImagensDaPagina(titulo, WIKIPEDIA_API);
      if (imgAlt) return imgAlt;
    }
  }

  for (const consulta of consultas) {
    const titulo = await buscarPagina(consulta, WIKIPEDIA_EN_API, ehPaginaDeCidade);
    if (titulo) {
      const img = await obterImagemDaPagina(titulo, WIKIPEDIA_EN_API);
      if (img) return img;

      const imgAlt = await obterImagensDaPagina(titulo, WIKIPEDIA_EN_API);
      if (imgAlt) return imgAlt;
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
  buscarImagemWikimediaCommons,
};

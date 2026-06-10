const WIKIPEDIA_API = 'https://pt.wikipedia.org/w/api.php';
const WIKIPEDIA_EN_API = 'https://en.wikipedia.org/w/api.php';

async function buscarResumoWikipedia(termo, cidade) {
  const consultas = [
    `${termo} ${cidade}`,
    termo,
  ];

  for (const consulta of consultas) {
    const resultado = await tentarBusca(consulta, WIKIPEDIA_API);
    if (resultado) return resultado;
  }

  for (const consulta of consultas) {
    const resultado = await tentarBusca(consulta, WIKIPEDIA_EN_API);
    if (resultado) return resultado;
  }

  return null;
}

async function buscarImagemWikipedia(termo, cidade) {
  const consultas = cidade ? [`${termo} ${cidade}`, termo] : [termo];

  for (const consulta of consultas) {
    const img = await tentarBuscarImagem(consulta, WIKIPEDIA_API);
    if (img) return img;
  }

  for (const consulta of consultas) {
    const img = await tentarBuscarImagem(consulta, WIKIPEDIA_EN_API);
    if (img) return img;
  }

  return null;
}

async function tentarBuscarImagem(termo, apiBase) {
  try {
    const searchUrl = `${apiBase}?action=query&list=search&srsearch=${encodeURIComponent(termo)}&format=json&srlimit=1&origin=*`;
    const searchResp = await fetch(searchUrl, {
      headers: { 'User-Agent': 'EasyTrip/1.0 (academic-project)' }
    });
    const searchData = await searchResp.json();

    const results = searchData?.query?.search;
    if (!results || results.length === 0) return null;

    const titulo = results[0].title;

    const imageUrl = `${apiBase}?action=query&titles=${encodeURIComponent(titulo)}&prop=pageimages&pithumbsize=800&format=json&origin=*`;
    const imageResp = await fetch(imageUrl, {
      headers: { 'User-Agent': 'EasyTrip/1.0 (academic-project)' }
    });
    const imageData = await imageResp.json();

    const pages = imageData?.query?.pages;
    if (!pages) return null;

    const pageId = Object.keys(pages)[0];
    if (pageId === '-1') return null;

    const page = pages[pageId];
    if (page.thumbnail?.source) {
      return page.thumbnail.source;
    }

    return null;
  } catch (err) {
    console.warn('[WikipediaService] Busca de imagem falhou para:', termo, err.message);
    return null;
  }
}

async function buscarImagensCidade(cidade) {
  const resultado = { headerImage: null, locaisImages: {} };

  const headerImg = await buscarImagemWikipedia(cidade, '');
  if (headerImg) {
    resultado.headerImage = headerImg;
  }

  return resultado;
}

async function buscarImagensParaLocais(locais, cidade) {
  const resultados = [];

  for (const local of locais) {
    const img = await buscarImagemWikipedia(local.nome, cidade);
    resultados.push({ ...local, imageUrl: img || null });
    await sleep(150);
  }

  return resultados;
}

async function tentarBusca(termo, apiBase) {
  try {
    const searchUrl = `${apiBase}?action=query&list=search&srsearch=${encodeURIComponent(termo)}&format=json&srlimit=1&origin=*`;

    const searchResp = await fetch(searchUrl, {
      headers: { 'User-Agent': 'EasyTrip/1.0 (academic-project)' }
    });
    const searchData = await searchResp.json();

    const results = searchData?.query?.search;
    if (!results || results.length === 0) return null;

    const titulo = results[0].title;

    const summaryUrl = `${apiBase}?action=query&titles=${encodeURIComponent(titulo)}&prop=extracts&exintro=true&explaintext=true&format=json&origin=*`;
    const summaryResp = await fetch(summaryUrl, {
      headers: { 'User-Agent': 'EasyTrip/1.0 (academic-project)' }
    });
    const summaryData = await summaryResp.json();

    const pages = summaryData?.query?.pages;
    if (!pages) return null;

    const pageId = Object.keys(pages)[0];
    if (pageId === '-1') return null;

    const page = pages[pageId];
    const extract = page.extract;

    if (!extract || extract.length < 30) return null;

    const resumo = extract.length > 500
      ? extract.substring(0, 500).replace(/\s+\S*$/, '') + '...'
      : extract;

    const lang = apiBase.includes('pt.wikipedia') ? 'pt' : 'en';
    const wikiUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(titulo.replace(/ /g, '_'))}`;

    return {
      summary: resumo,
      wikipediaUrl: wikiUrl,
      title: titulo,
    };
  } catch (err) {
    console.warn('[WikipediaService] Busca falhou para:', termo, err.message);
    return null;
  }
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

    await sleep(200);
  }

  console.log(`[WikipediaService] Enriquecidos ${enriquecidos}/${paraEnriquecer.length} lugares com Wikipedia`);
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
  buscarImagensCidade,
  buscarImagensParaLocais,
};

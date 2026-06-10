const { buscarImagemWikipedia } = require('./wikipediaService');

const PEXELS_BASE_URL = 'https://api.pexels.com/v1';
const PIXABAY_BASE_URL = 'https://pixabay.com/api';

const imageCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

function getCacheKey(query) {
  return query.toLowerCase().trim();
}

function getFromCache(key) {
  const entry = imageCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    imageCache.delete(key);
    return null;
  }
  return entry.url;
}

function setCache(key, url) {
  if (imageCache.size > 500) {
    const oldest = imageCache.keys().next().value;
    imageCache.delete(oldest);
  }
  imageCache.set(key, { url, timestamp: Date.now() });
}

async function buscarImagemPexels(query, orientation = 'landscape') {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `${PEXELS_BASE_URL}/search?query=${encodeURIComponent(query)}&per_page=1&orientation=${orientation}&size=medium`;
    const resp = await fetch(url, {
      headers: { 'Authorization': apiKey }
    });

    if (!resp.ok) {
      console.warn(`[ImageService] Pexels retornou status ${resp.status} para: ${query}`);
      return null;
    }

    const data = await resp.json();
    if (data.photos && data.photos.length > 0) {
      return data.photos[0].src.large;
    }

    return null;
  } catch (err) {
    console.warn('[ImageService] Erro Pexels para:', query, err.message);
    return null;
  }
}

async function buscarImagemPixabay(query, category = 'travel') {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `${PIXABAY_BASE_URL}/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=3&category=${category}&safesearch=true`;
    const resp = await fetch(url);

    if (!resp.ok) return null;

    const data = await resp.json();
    if (data.hits && data.hits.length > 0) {
      return data.hits[0].webformatURL;
    }

    return null;
  } catch (err) {
    console.warn('[ImageService] Erro Pixabay para:', query, err.message);
    return null;
  }
}

async function buscarImagem(nome, cidade, opcoes = {}) {
  const { tipo = 'local' } = opcoes;

  const queryCompleta = cidade ? `${nome} ${cidade}` : nome;
  const cacheKey = getCacheKey(queryCompleta);

  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  let imageUrl = null;

  imageUrl = await buscarImagemPexels(queryCompleta, 'landscape');

  if (!imageUrl && cidade) {
    imageUrl = await buscarImagemPexels(cidade, 'landscape');
  }

  if (!imageUrl) {
    imageUrl = await buscarImagemPixabay(queryCompleta, tipo === 'restaurante' ? 'food' : 'travel');
  }

  if (!imageUrl) {
    imageUrl = await buscarImagemWikipedia(nome, cidade || '');
  }

  if (!imageUrl && cidade) {
    imageUrl = await buscarImagemWikipedia(cidade, '');
  }

  if (imageUrl) {
    setCache(cacheKey, imageUrl);
  }

  return imageUrl;
}

async function buscarImagemCidade(cidade) {
  const cacheKey = getCacheKey(`header_${cidade}`);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  let imageUrl = null;

  imageUrl = await buscarImagemPexels(`${cidade} city`, 'landscape');

  if (!imageUrl) {
    imageUrl = await buscarImagemPixabay(cidade, 'travel');
  }

  if (!imageUrl) {
    imageUrl = await buscarImagemWikipedia(cidade, '');
  }

  if (imageUrl) {
    setCache(cacheKey, imageUrl);
  }

  return imageUrl;
}

async function buscarImagensParaLista(itens, cidade, tipo = 'local') {
  const resultados = [];

  for (const item of itens) {
    const imageUrl = await buscarImagem(item.nome, cidade, { tipo });
    resultados.push({ ...item, imageUrl });
    await new Promise(r => setTimeout(r, 100));
  }

  return resultados;
}

module.exports = {
  buscarImagem,
  buscarImagemCidade,
  buscarImagensParaLista,
  buscarImagemPexels,
};

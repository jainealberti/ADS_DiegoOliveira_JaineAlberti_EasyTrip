const { buscarImagemWikipedia, buscarImagemCidadeWikipedia } = require('./wikipediaService');

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

async function buscarImagemPexels(query, orientation = 'landscape', urlsUsadas = null) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `${PEXELS_BASE_URL}/search?query=${encodeURIComponent(query)}&per_page=10&orientation=${orientation}&size=medium`;
    const resp = await fetch(url, {
      headers: { 'Authorization': apiKey }
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    if (!data.photos || data.photos.length === 0) return null;

    const queryWords = query.toLowerCase().split(/[\s,]+/).filter(w => w.length > 3);

    const fotos = data.photos.filter(p => {
      if (urlsUsadas && urlsUsadas.has(p.src.large)) return false;
      return true;
    });

    if (fotos.length === 0) return null;

    const relevante = fotos.find(p => {
      const alt = (p.alt || '').toLowerCase();
      const matches = queryWords.filter(w => alt.includes(w));
      return matches.length >= 2;
    });

    return relevante ? relevante.src.large : fotos[0].src.large;
  } catch (err) {
    console.warn('[ImageService] Erro Pexels:', err.message);
    return null;
  }
}

async function buscarImagemPixabay(query, category = 'travel', urlsUsadas = null) {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `${PIXABAY_BASE_URL}/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=10&category=${category}&safesearch=true`;
    const resp = await fetch(url);

    if (!resp.ok) return null;

    const data = await resp.json();
    if (!data.hits || data.hits.length === 0) return null;

    const fotos = data.hits.filter(h => {
      if (urlsUsadas && urlsUsadas.has(h.webformatURL)) return false;
      return true;
    });

    if (fotos.length === 0) return null;

    return fotos[0].webformatURL;
  } catch (err) {
    console.warn('[ImageService] Erro Pixabay:', err.message);
    return null;
  }
}

async function buscarImagem(nome, cidade, opcoes = {}) {
  const { tipo = 'local', urlsUsadas = null } = opcoes;

  const queryCompleta = cidade ? `${nome} ${cidade}` : nome;
  const cacheKey = getCacheKey(queryCompleta);

  const cached = getFromCache(cacheKey);
  if (cached && (!urlsUsadas || !urlsUsadas.has(cached))) {
    return cached;
  }

  let imageUrl = null;

  imageUrl = await buscarImagemWikipedia(nome, cidade || '');
  if (imageUrl && urlsUsadas && urlsUsadas.has(imageUrl)) imageUrl = null;

  if (!imageUrl) {
    const palavraChave = opcoes.palavraChaveImagem || nome;
    imageUrl = await buscarImagemPexels(`${palavraChave} ${cidade || ''}`.trim(), 'landscape', urlsUsadas);
  }

  if (!imageUrl && cidade) {
    const genero = tipo === 'restaurante' ? 'restaurant food' : 'tourism landmark';
    imageUrl = await buscarImagemPexels(`${cidade} ${genero}`, 'landscape', urlsUsadas);
  }

  if (!imageUrl) {
    imageUrl = await buscarImagemPixabay(queryCompleta, tipo === 'restaurante' ? 'food' : 'travel', urlsUsadas);
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

  imageUrl = await buscarImagemCidadeWikipedia(cidade);

  if (!imageUrl) {
    imageUrl = await buscarImagemPexels(`${cidade} city`, 'landscape');
  }

  if (!imageUrl) {
    imageUrl = await buscarImagemPixabay(cidade, 'travel');
  }

  if (imageUrl) {
    setCache(cacheKey, imageUrl);
  }

  return imageUrl;
}

async function buscarImagensParaLista(itens, cidade, tipo = 'local', ...imagensAnteriores) {
  const resultados = [];
  const urlsUsadas = new Set();

  for (const anterior of imagensAnteriores) {
    if (typeof anterior === 'string' && anterior) {
      urlsUsadas.add(anterior);
    } else if (Array.isArray(anterior)) {
      anterior.forEach(item => {
        if (item?.imageUrl) urlsUsadas.add(item.imageUrl);
      });
    }
  }

  for (const item of itens) {
    const nomeLocal = item.palavraChaveImagem || item.nome || item.name || '';
    const imageUrl = await buscarImagem(nomeLocal, cidade, {
      tipo,
      palavraChaveImagem: item.palavraChaveImagem,
      urlsUsadas,
    });

    if (imageUrl) {
      urlsUsadas.add(imageUrl);
    }

    resultados.push({ ...item, imageUrl });
  }

  return resultados;
}

module.exports = {
  buscarImagem,
  buscarImagemCidade,
  buscarImagensParaLista,
  buscarImagemPexels,
};

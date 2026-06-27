const {
  buscarImagemWikipedia,
  buscarImagemCidadeWikipedia,
  buscarImagemWikimediaCommons,
} = require('./wikipediaService');

const PEXELS_BASE_URL = 'https://api.pexels.com/v1';
const PIXABAY_BASE_URL = 'https://pixabay.com/api';
const PLACES_FIND_URL = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';
const PLACES_PHOTO_URL = 'https://maps.googleapis.com/maps/api/place/photo';

const imageCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

const TERMOS_GENERICOS_BLOQUEADOS = [
  'bird', 'food', 'restaurant', 'tourism', 'nature', 'landscape',
  'waterfall', 'church', 'cathedral', 'market', 'cuisine',
  'travel', 'hotel', 'beach', 'mountain', 'sunset',
  'city', 'building', 'street', 'road', 'sky',
  'animal', 'flower', 'tree', 'river', 'lake',
];

function queryEhGenerica(query) {
  const palavras = query.toLowerCase().trim().split(/[\s,]+/);
  if (palavras.length <= 2) {
    return palavras.every(p => TERMOS_GENERICOS_BLOQUEADOS.includes(p));
  }
  return false;
}

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

function ehUrlValida(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

// ─── Google Places Photos API (Legacy) ───

function montarPlacesPhotoUrl(photoReference, maxWidth = 800) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  return `${PLACES_PHOTO_URL}?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${apiKey}`;
}

async function buscarImagemGooglePlaces(query, urlsUsadas = null) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.log('[GooglePlaces] Sem GOOGLE_PLACES_API_KEY configurada');
    return null;
  }

  try {
    const url = `${PLACES_FIND_URL}?input=${encodeURIComponent(query)}&inputtype=textquery&fields=photos,name,place_id&key=${apiKey}`;
    console.log(`[GooglePlaces] Buscando: "${query}"`);
    const resp = await fetch(url);

    if (!resp.ok) {
      console.warn(`[GooglePlaces] Find falhou (${resp.status})`);
      return null;
    }

    const data = await resp.json();
    if (data.status !== 'OK' || !data.candidates || data.candidates.length === 0) {
      console.log(`[GooglePlaces] Sem candidatos para: "${query}" (status: ${data.status})`);
      return null;
    }

    const place = data.candidates[0];
    if (!place.photos || place.photos.length === 0) {
      console.log(`[GooglePlaces] Sem fotos para: "${query}" (place: ${place.name})`);
      return null;
    }

    for (const photo of place.photos.slice(0, 3)) {
      const photoUrl = montarPlacesPhotoUrl(photo.photo_reference, 800);
      if (urlsUsadas && urlsUsadas.has(photoUrl)) continue;

      console.log(`[GooglePlaces] ✓ Foto para "${query}" → place: "${place.name}"`);
      return photoUrl;
    }

    return null;
  } catch (err) {
    console.warn('[GooglePlaces] Erro:', err.message);
    return null;
  }
}

async function buscarImagemCidadeGooglePlaces(cidade) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  try {
    const cidadeSimples = cidade.split(',')[0].trim();
    const url = `${PLACES_FIND_URL}?input=${encodeURIComponent(cidadeSimples)}&inputtype=textquery&fields=photos,name,place_id&key=${apiKey}`;
    console.log(`[GooglePlaces] Header cidade: "${cidadeSimples}"`);
    const resp = await fetch(url);

    if (!resp.ok) return null;

    const data = await resp.json();
    if (data.status !== 'OK' || !data.candidates?.[0]?.photos?.length) return null;

    const place = data.candidates[0];
    const photoUrl = montarPlacesPhotoUrl(place.photos[0].photo_reference, 1200);
    console.log(`[GooglePlaces] ✓ Header "${cidade}" → "${place.name}"`);
    return photoUrl;
  } catch (err) {
    console.warn('[GooglePlaces] Erro header cidade:', err.message);
    return null;
  }
}

// ─── Pexels ───

async function buscarImagemPexels(query, orientation = 'landscape', urlsUsadas = null) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `${PEXELS_BASE_URL}/search?query=${encodeURIComponent(query)}&per_page=15&orientation=${orientation}&size=medium`;
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

    let melhorFoto = null;
    let melhorScore = 0;

    for (const p of fotos) {
      const alt = (p.alt || '').toLowerCase();
      const matches = queryWords.filter(w => alt.includes(w));
      const score = queryWords.length > 0 ? matches.length / queryWords.length : 0;

      if (score > melhorScore) {
        melhorScore = score;
        melhorFoto = p;
      }
    }

    if (melhorScore >= 0.6 && melhorFoto) {
      console.log(`[Pexels] ✓ Foto para "${query}" (score: ${melhorScore.toFixed(2)}, alt: "${melhorFoto.alt?.substring(0, 60)}")`);
      return melhorFoto.src.large;
    }

    console.log(`[Pexels] ✗ Rejeitada para "${query}" (score: ${melhorScore.toFixed(2)} < 0.6)`);
    return null;
  } catch (err) {
    console.warn('[Pexels] Erro:', err.message);
    return null;
  }
}

// ─── Pixabay ───

async function buscarImagemPixabay(query, category = 'travel', urlsUsadas = null) {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `${PIXABAY_BASE_URL}/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=10&category=${category}&safesearch=true`;
    const resp = await fetch(url);

    if (!resp.ok) return null;

    const data = await resp.json();
    if (!data.hits || data.hits.length === 0) return null;

    const queryWords = query.toLowerCase().split(/[\s,]+/).filter(w => w.length > 3);

    const fotos = data.hits.filter(h => {
      if (urlsUsadas && urlsUsadas.has(h.webformatURL)) return false;
      return true;
    });

    if (fotos.length === 0) return null;

    let melhorFoto = null;
    let melhorScore = 0;

    for (const h of fotos) {
      const tags = (h.tags || '').toLowerCase();
      const matches = queryWords.filter(w => tags.includes(w));
      const score = queryWords.length > 0 ? matches.length / queryWords.length : 0;

      if (score > melhorScore) {
        melhorScore = score;
        melhorFoto = h;
      }
    }

    if (melhorScore >= 0.5 && melhorFoto) {
      console.log(`[Pixabay] ✓ Foto para "${query}" (score: ${melhorScore.toFixed(2)})`);
      return melhorFoto.webformatURL;
    }

    return null;
  } catch (err) {
    console.warn('[Pixabay] Erro:', err.message);
    return null;
  }
}

// ─── Busca principal (cadeia de 4 camadas) ───

async function buscarImagem(nome, cidade, opcoes = {}) {
  try {
    const { tipo = 'local', urlsUsadas = null } = opcoes;

    const palavraChave = opcoes.palavraChaveImagem || nome;

    if (queryEhGenerica(palavraChave)) {
      console.warn(`[ImageService] BLOQUEADA query genérica: "${palavraChave}" para "${nome}" — usando nome completo`);
    }

    const queryParaGoogle = cidade
      ? `${palavraChave} ${cidade}`
      : palavraChave;

    const cacheKey = getCacheKey(queryParaGoogle);

    const cached = getFromCache(cacheKey);
    if (cached && (!urlsUsadas || !urlsUsadas.has(cached))) {
      console.log(`[ImageService] Cache hit: "${nome}"`);
      return cached;
    }

    let imageUrl = null;
    let fonte = '';

    console.log(`[ImageService] ── Buscando imagem para: "${nome}" ──`);
    console.log(`[ImageService]    palavraChave: "${palavraChave}"`);
    console.log(`[ImageService]    queryGoogle:  "${queryParaGoogle}"`);

    // Camada 1: Google Places Photos (mais precisa — usa nome real do local)
    imageUrl = await buscarImagemGooglePlaces(queryParaGoogle, urlsUsadas);
    if (imageUrl && ehUrlValida(imageUrl)) {
      fonte = 'GooglePlaces';
    } else {
      imageUrl = null;
    }

    // Camada 2: Wikipedia (artigo do local)
    if (!imageUrl) {
      imageUrl = await buscarImagemWikipedia(palavraChave, cidade || '');
      if (imageUrl && urlsUsadas && urlsUsadas.has(imageUrl)) imageUrl = null;
      if (imageUrl && !ehUrlValida(imageUrl)) imageUrl = null;
      if (imageUrl) fonte = 'Wikipedia';
    }

    // Camada 2b: Wikimedia Commons
    if (!imageUrl) {
      const commonsQueries = cidade
        ? [`${palavraChave} ${cidade}`, palavraChave]
        : [palavraChave];

      for (const q of commonsQueries) {
        imageUrl = await buscarImagemWikimediaCommons(q);
        if (imageUrl && urlsUsadas && urlsUsadas.has(imageUrl)) imageUrl = null;
        if (imageUrl && !ehUrlValida(imageUrl)) imageUrl = null;
        if (imageUrl) { fonte = 'WikiCommons'; break; }
      }
    }

    // Camada 3: Pexels (threshold alto, só aceita se muito relevante)
    if (!imageUrl && !queryEhGenerica(palavraChave)) {
      imageUrl = await buscarImagemPexels(queryParaGoogle.trim(), 'landscape', urlsUsadas);
      if (imageUrl && !ehUrlValida(imageUrl)) imageUrl = null;
      if (imageUrl) fonte = 'Pexels';
    }

    // Camada 4: Pixabay (threshold alto)
    if (!imageUrl && !queryEhGenerica(palavraChave)) {
      const category = tipo === 'restaurante' ? 'food' : 'travel';
      imageUrl = await buscarImagemPixabay(queryParaGoogle, category, urlsUsadas);
      if (imageUrl && !ehUrlValida(imageUrl)) imageUrl = null;
      if (imageUrl) fonte = 'Pixabay';
    }

    if (imageUrl) {
      setCache(cacheKey, imageUrl);
      console.log(`[ImageService] ✓ "${nome}" → ${fonte}`);
    } else {
      console.log(`[ImageService] ✗ "${nome}" → NENHUMA imagem (fallback visual será usado)`);
    }

    return imageUrl;
  } catch (err) {
    console.warn('[ImageService] Erro inesperado em buscarImagem:', nome, err.message);
    return null;
  }
}

// ─── Utilitários ───

function comTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Timeout de busca de imagem')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const TIMEOUT_POR_ITEM_MS = 10_000;
const TIMEOUT_HEADER_MS = 12_000;

// ─── Header da cidade ───

async function buscarImagemCidade(cidade) {
  try {
    const cacheKey = getCacheKey(`header_${cidade}`);
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const buscar = async () => {
      let imageUrl = null;

      imageUrl = await buscarImagemCidadeGooglePlaces(cidade);

      if (!imageUrl) {
        imageUrl = await buscarImagemCidadeWikipedia(cidade);
      }

      if (!imageUrl) {
        const cidadeSimples = cidade.split(',')[0].trim();
        const commonsQueries = [
          `${cidadeSimples} city skyline`,
          `${cidadeSimples} panorama`,
          cidadeSimples,
        ];
        for (const q of commonsQueries) {
          imageUrl = await buscarImagemWikimediaCommons(q);
          if (imageUrl) break;
        }
      }

      if (!imageUrl) {
        imageUrl = await buscarImagemPexels(`${cidade} city`, 'landscape');
      }

      return imageUrl;
    };

    const imageUrl = await comTimeout(buscar(), TIMEOUT_HEADER_MS);

    if (imageUrl && ehUrlValida(imageUrl)) {
      setCache(cacheKey, imageUrl);
      console.log(`[ImageService] Header "${cidade}" → encontrada`);
      return imageUrl;
    }

    console.log(`[ImageService] Header "${cidade}" → nenhuma imagem`);
    return null;
  } catch (err) {
    console.warn('[ImageService] Erro/timeout em buscarImagemCidade:', cidade, err.message);
    return null;
  }
}

// ─── Busca em lote para listas ───

async function buscarImagensParaLista(itens, cidade, tipo = 'local', ...imagensAnteriores) {
  try {
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

    console.log(`\n[ImageService] ═══ Buscando imagens para ${itens.length} itens (${tipo}) em "${cidade}" ═══`);

    for (const item of itens) {
      const nome = item.nome || item.name || '';
      const palavraChave = item.palavraChaveImagem || nome;

      console.log(`[ImageService] ── Item: "${nome}" | palavraChave: "${palavraChave}" ──`);

      let imageUrl = null;
      let fallbackImage = false;

      try {
        imageUrl = await comTimeout(
          buscarImagem(nome, cidade, {
            tipo,
            palavraChaveImagem: palavraChave,
            urlsUsadas,
          }),
          TIMEOUT_POR_ITEM_MS,
        );
      } catch {
        console.warn(`[ImageService] Timeout ao buscar imagem para: "${nome}"`);
      }

      if (imageUrl && ehUrlValida(imageUrl)) {
        urlsUsadas.add(imageUrl);
      } else {
        imageUrl = null;
        fallbackImage = true;
        console.log(`[ImageService] → Fallback visual ativado para: "${nome}"`);
      }

      resultados.push({
        ...item,
        imageUrl: imageUrl || null,
        fallbackImage,
      });
    }

    console.log(`[ImageService] ═══ Resultado: ${resultados.filter(r => r.imageUrl).length}/${resultados.length} com imagem ═══\n`);

    return resultados;
  } catch (err) {
    console.warn('[ImageService] Erro inesperado em buscarImagensParaLista:', cidade, err.message);
    return (itens || []).map(item => ({ ...item, imageUrl: null, fallbackImage: true }));
  }
}

module.exports = {
  buscarImagem,
  buscarImagemCidade,
  buscarImagensParaLista,
  buscarImagemPexels,
  buscarImagemGooglePlaces,
};

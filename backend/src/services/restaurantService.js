const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const CATEGORIAS_GASTRONOMIA = [
  { tag: 'amenity=restaurant', type: 'restaurante', category: 'gastronomia' },
  { tag: 'amenity=cafe', type: 'café', category: 'gastronomia' },
  { tag: 'amenity=bar', type: 'bar', category: 'gastronomia' },
  { tag: 'amenity=fast_food', type: 'fast food', category: 'gastronomia' },
  { tag: 'amenity=ice_cream', type: 'sorveteria', category: 'gastronomia' },
  { tag: 'amenity=pub', type: 'pub', category: 'gastronomia' },
];

function extrairEndereco(tags) {
  const partes = [];
  if (tags['addr:street']) {
    partes.push(tags['addr:street']);
    if (tags['addr:housenumber']) partes.push(tags['addr:housenumber']);
  }
  if (tags['addr:suburb'] || tags['addr:neighbourhood']) {
    partes.push(tags['addr:suburb'] || tags['addr:neighbourhood']);
  }
  if (tags['addr:city']) partes.push(tags['addr:city']);
  return partes.join(', ') || null;
}

function classificarRestaurante(tags) {
  for (const cat of CATEGORIAS_GASTRONOMIA) {
    const [key, value] = cat.tag.split('=');
    if (tags[key] === value) {
      return { type: cat.type, category: cat.category };
    }
  }
  return { type: 'restaurante', category: 'gastronomia' };
}

function parsearRestaurante(element) {
  const tags = element.tags || {};
  const nome = tags.name || tags['name:pt'] || tags['name:en'];
  if (!nome) return null;

  let lat, lng;
  if (element.type === 'node') {
    lat = element.lat;
    lng = element.lon;
  } else if (element.center) {
    lat = element.center.lat;
    lng = element.center.lon;
  } else {
    return null;
  }

  if (!lat || !lng) return null;

  const { type, category } = classificarRestaurante(tags);

  return {
    id: `osm_${element.type}_${element.id}`,
    name: nome,
    type,
    category,
    address: extrairEndereco(tags),
    latitude: lat,
    longitude: lng,
    source: 'OpenStreetMap',
    description: tags.description || tags['description:pt'] || '',
    cuisine: tags.cuisine || null,
    website: tags.website || tags['contact:website'] || null,
    phone: tags.phone || tags['contact:phone'] || null,
    openingHours: tags.opening_hours || null,
    wheelchair: tags.wheelchair || null,
    vegetarian: tags['diet:vegetarian'] || null,
    vegan: tags['diet:vegan'] || null,
  };
}

async function executarQuery(query) {
  const resp = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': '*/*',
      'User-Agent': 'EasyTrip/1.0 (academic-project)',
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!resp.ok) return [];

  const data = await resp.json();
  return data.elements || [];
}

async function buscarRestaurantes(lat, lng, raioMetros = 8000) {
  const queryRestaurantes = `[out:json][timeout:25];nwr["amenity"~"restaurant|cafe"]["name"](around:${raioMetros},${lat},${lng});out center 40;`;
  const queryBares = `[out:json][timeout:25];nwr["amenity"~"bar|pub|fast_food|ice_cream"]["name"](around:${raioMetros},${lat},${lng});out center 20;`;

  try {
    const [restaurantes, bares] = await Promise.all([
      executarQuery(queryRestaurantes),
      executarQuery(queryBares),
    ]);

    const elementos = [...restaurantes, ...bares];
    const parsed = elementos.map(parsearRestaurante).filter(Boolean);
    const unicos = removerDuplicados(parsed);

    console.log(`[RestaurantService] Encontrados ${unicos.length} restaurantes/cafés reais`);
    return unicos;
  } catch (err) {
    console.error('[RestaurantService] Erro ao buscar restaurantes:', err.message);
    return [];
  }
}

function removerDuplicados(restaurantes) {
  const vistos = new Map();
  for (const r of restaurantes) {
    const chave = r.name.toLowerCase().trim();
    if (!vistos.has(chave)) {
      vistos.set(chave, r);
    }
  }
  return [...vistos.values()];
}

module.exports = { buscarRestaurantes };

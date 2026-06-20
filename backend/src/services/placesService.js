const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const CATEGORIAS_TURISMO = [
  { tag: 'tourism=attraction', type: 'atração', category: 'turismo' },
  { tag: 'tourism=museum', type: 'museu', category: 'cultural' },
  { tag: 'tourism=viewpoint', type: 'mirante', category: 'turismo' },
  { tag: 'tourism=gallery', type: 'galeria', category: 'cultural' },
  { tag: 'historic=monument', type: 'monumento', category: 'histórico' },
  { tag: 'leisure=park', type: 'parque', category: 'natureza' },
  { tag: 'amenity=theatre', type: 'teatro', category: 'cultural' },
  { tag: 'amenity=arts_centre', type: 'centro cultural', category: 'cultural' },
  { tag: 'amenity=place_of_worship', type: 'templo/igreja', category: 'cultural' },
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

function classificarElemento(tags) {
  for (const cat of CATEGORIAS_TURISMO) {
    const [key, value] = cat.tag.split('=');
    if (tags[key] === value) {
      return { type: cat.type, category: cat.category };
    }
  }
  return { type: 'ponto de interesse', category: 'outro' };
}

function parsearElemento(element) {
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

  const { type, category } = classificarElemento(tags);

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
    website: tags.website || tags['contact:website'] || null,
    openingHours: tags.opening_hours || null,
    wheelchair: tags.wheelchair || null,
    fee: tags.fee || null,
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

async function buscarLugares(lat, lng, raioMetros = 12000) {
  const todosLugares = [];

  const queryTurismo = `[out:json][timeout:25];nwr["tourism"~"attraction|museum|viewpoint|gallery"]["name"](around:${raioMetros},${lat},${lng});out center 40;`;
  const queryHistorico = `[out:json][timeout:25];nwr["historic"~"monument|memorial"]["name"](around:${raioMetros},${lat},${lng});out center 20;`;
  const queryLazer = `[out:json][timeout:25];nwr["leisure"~"park|garden"]["name"](around:${raioMetros},${lat},${lng});out center 20;`;
  const queryCultural = `[out:json][timeout:25];nwr["amenity"~"theatre|arts_centre"]["name"](around:${raioMetros},${lat},${lng});out center 15;`;

  try {
    const [turismo, historico, lazer, cultural] = await Promise.all([
      executarQuery(queryTurismo),
      executarQuery(queryHistorico),
      executarQuery(queryLazer),
      executarQuery(queryCultural),
    ]);

    const elementos = [...turismo, ...historico, ...lazer, ...cultural];
    const lugares = elementos.map(parsearElemento).filter(Boolean);
    const unicos = removerDuplicados(lugares);

    console.log(`[PlacesService] Encontrados ${unicos.length} lugares turísticos reais`);
    return unicos;
  } catch (err) {
    console.error('[PlacesService] Erro ao buscar lugares:', err.message);
    return [];
  }
}

function removerDuplicados(lugares) {
  const vistos = new Map();
  for (const lugar of lugares) {
    const chave = lugar.name.toLowerCase().trim();
    if (!vistos.has(chave)) {
      vistos.set(chave, lugar);
    }
  }
  return [...vistos.values()];
}

module.exports = { buscarLugares };

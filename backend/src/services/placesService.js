const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

function gerarPlaceId(source, name, lat, lng) {
  const slug = (name || 'place').toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 40);
  const coordHash = `${lat.toFixed(4)}_${lng.toFixed(4)}`.replace(/[.-]/g, '');
  return `${source}_${slug}_${coordHash}`;
}

async function buscarAtracoesWikipedia(lat, lng, cidade = '', raioMetros = 10000) {
  const resultados = [];
  const vistos = new Set();
  const cidadeNomeLower = cidade.toLowerCase().trim();

  for (const lang of ['pt', 'en']) {
    try {
      const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lng}&gsradius=${raioMetros}&gslimit=50&format=json`;

      let resp;
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        resp = await fetch(url, {
          headers: { 'User-Agent': 'EasyTrip/1.0 (travel-planner; contact@easytrip.com)' }
        });
        if (resp.status !== 429) break;
        console.warn(`[Wikipedia] ${lang} rate limited, tentativa ${tentativa + 1}/3, aguardando...`);
        await sleep(2000 * (tentativa + 1));
      }

      if (!resp.ok) {
        console.warn(`[Wikipedia] ${lang} HTTP ${resp.status}`);
        continue;
      }

      const data = await resp.json();
      const items = data.query?.geosearch || [];
      console.log(`[PlacesService] Wikipedia ${lang}: ${items.length} resultados`);

      for (const item of items) {
        const chave = `${item.lat.toFixed(3)}_${item.lon.toFixed(3)}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);

        const nomeOriginal = item.title;
        const nomeLower = nomeOriginal.toLowerCase();
        const nomeInvalido = nomeLower.includes('crash') ||
          nomeLower.includes('airport') ||
          nomeLower.includes('aeroporto') ||
          nomeLower.includes('município') ||
          nomeLower.includes('microrregião') ||
          nomeLower.includes('mesorregião') ||
          nomeOriginal.includes('(Rio Grande do Sul)') ||
          nomeOriginal.includes('(Santa Catarina)') ||
          nomeOriginal.includes('(Paraná)') ||
          nomeOriginal.includes('(São Paulo)') ||
          nomeOriginal.includes('(Rio de Janeiro)') ||
          nomeLower === cidadeNomeLower;

        if (nomeInvalido) continue;

        let descricao = '';
        try {
          const extractUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(nomeOriginal)}&prop=extracts&exintro=true&explaintext=true&exsentences=3&format=json`;
          const extractResp = await fetch(extractUrl, {
            headers: { 'User-Agent': 'EasyTrip/1.0' }
          });
          if (extractResp.ok) {
            const extractData = await extractResp.json();
            const pages = extractData.query?.pages || {};
            const page = Object.values(pages)[0];
            descricao = page?.extract?.substring(0, 350) || '';
          }
          await sleep(150);
        } catch { /* best-effort */ }

        resultados.push({
          id: gerarPlaceId('wiki', nomeOriginal, item.lat, item.lon),
          name: nomeOriginal,
          type: 'attraction',
          address: '',
          latitude: item.lat,
          longitude: item.lon,
          source: `Wikipedia`,
          description: descricao,
          rating: 0,
          categories: ['ponto turístico', 'atração'],
          wikiLang: lang
        });
      }
    } catch (err) {
      console.error(`[PlacesService] Erro Wikipedia ${lang}:`, err.message);
    }

    await sleep(500);
  }

  return resultados;
}

async function buscarRestaurantesNominatim(lat, lng, cidade, raioKm = 10) {
  const offset = raioKm / 111;
  const viewbox = `${lng - offset},${lat - offset},${lng + offset},${lat + offset}`;
  const resultados = [];

  const tipos = ['restaurant', 'cafe', 'bar'];

  for (const tipo of tipos) {
    try {
      const url = `${NOMINATIM_BASE}/search?q=${tipo}+${encodeURIComponent(cidade)}&format=json&limit=15&viewbox=${viewbox}&bounded=1&addressdetails=1`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'EasyTrip/1.0 (travel-planner)' }
      });

      if (!resp.ok) {
        console.warn(`[Nominatim] ${tipo} HTTP ${resp.status}`);
        continue;
      }

      const data = await resp.json();
      console.log(`[PlacesService] Nominatim ${tipo}: ${data.length} resultados`);

      for (const item of data) {
        const name = item.display_name.split(',')[0].trim();
        if (!name || name.length < 2) continue;

        const itemLat = parseFloat(item.lat);
        const itemLng = parseFloat(item.lon);

        const addr = item.address || {};
        const address = [addr.road, addr.house_number, addr.suburb, addr.city || addr.town]
          .filter(Boolean).join(', ');

        const categories = ['gastronomia'];
        if (tipo === 'cafe') categories.push('café');
        if (tipo === 'bar') categories.push('bar');
        if (tipo === 'restaurant') categories.push('restaurante');

        resultados.push({
          id: gerarPlaceId('nom', name, itemLat, itemLng),
          name,
          type: 'restaurant',
          address,
          latitude: itemLat,
          longitude: itemLng,
          source: 'Nominatim/OSM',
          description: `${tipo === 'cafe' ? 'Café' : tipo === 'bar' ? 'Bar' : 'Restaurante'} em ${addr.city || addr.town || cidade}`,
          rating: 0,
          categories
        });
      }

      await sleep(1100);
    } catch (err) {
      console.error(`[PlacesService] Erro Nominatim ${tipo}:`, err.message);
    }
  }

  return resultados;
}

async function buscarTodosLugares(lat, lng, cidade) {
  const cidadeNome = cidade || 'cidade';
  console.log(`[PlacesService] Buscando lugares reais para "${cidadeNome}" (${lat}, ${lng})`);

  let atracoes = [];
  let restaurantes = [];

  try {
    atracoes = await buscarAtracoesWikipedia(lat, lng, cidadeNome);
  } catch (err) {
    console.error('[PlacesService] Erro total atrações:', err.message);
  }

  try {
    restaurantes = await buscarRestaurantesNominatim(lat, lng, cidadeNome);
  } catch (err) {
    console.error('[PlacesService] Erro total restaurantes:', err.message);
  }

  const todos = [...atracoes, ...restaurantes];
  const vistos = new Set();
  const unicos = [];
  for (const lugar of todos) {
    const chave = `${lugar.name.toLowerCase().trim()}_${lugar.latitude.toFixed(3)}_${lugar.longitude.toFixed(3)}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    unicos.push(lugar);
  }

  unicos.sort((a, b) => (b.rating || 0) - (a.rating || 0));

  console.log(`[PlacesService] TOTAL FINAL: ${unicos.length} lugares únicos (${atracoes.length} atrações + ${restaurantes.length} restaurantes)`);

  return unicos;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { buscarTodosLugares };

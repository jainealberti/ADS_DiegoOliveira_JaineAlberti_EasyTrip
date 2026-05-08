const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

async function resolverCidade(cidade) {
  try {
    const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(cidade)}&format=json&limit=1&addressdetails=1`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'EasyTrip/1.0 (travel-planner-academic)' }
    });
    const data = await resp.json();

    if (data && data.length > 0) {
      const item = data[0];
      const addr = item.address || {};
      return {
        cidade: addr.city || addr.town || addr.village || cidade,
        estado: addr.state || '',
        pais: addr.country || '',
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        displayName: item.display_name || cidade,
        boundingBox: item.boundingbox
          ? item.boundingbox.map(Number)
          : null
      };
    }
  } catch (err) {
    console.warn('[CityService] Geocodificação falhou:', err.message);
  }

  return {
    cidade: cidade,
    estado: '',
    pais: 'Brasil',
    latitude: -15.7801,
    longitude: -47.9292,
    displayName: cidade,
    boundingBox: null
  };
}

module.exports = { resolverCidade };

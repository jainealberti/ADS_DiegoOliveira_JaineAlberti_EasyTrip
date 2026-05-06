const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

async function geocodificarCidade(cidade) {
  try {
    const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(cidade)}&format=json&limit=1&addressdetails=1`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'EasyTrip/1.0 (travel-planner)' }
    });
    const data = await resp.json();

    if (data && data.length > 0) {
      const item = data[0];
      const addr = item.address || {};
      return {
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        cityName: addr.city || addr.town || addr.village || cidade,
        state: addr.state || '',
        country: addr.country || '',
        displayName: item.display_name || cidade
      };
    }
  } catch (err) {
    console.warn('[GeoService] Geocodificação falhou:', err.message);
  }

  return {
    lat: -15.7801,
    lng: -47.9292,
    cityName: cidade,
    state: '',
    country: 'Brasil',
    displayName: cidade
  };
}

module.exports = { geocodificarCidade };

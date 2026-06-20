const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

async function geocodificarCidade(cidade) {
  const tentativas = [cidade];

  const semAcentos = cidade.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (semAcentos !== cidade) tentativas.push(semAcentos);

  if (!cidade.toLowerCase().includes('brasil') && !cidade.includes(',')) {
    tentativas.push(`${cidade}, Brasil`);
  }

  for (const query of tentativas) {
    try {
      const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'EasyTrip/1.0 (travel-planner)' }
      });
      const data = await resp.json();

      if (data && data.length > 0) {
        const tiposValidos = ['city', 'town', 'village', 'hamlet', 'municipality', 'administrative'];
        const localidade = data.find(item => {
          const tipo = (item.type || '').toLowerCase();
          const classe = (item.class || '').toLowerCase();
          return tiposValidos.some(t => tipo.includes(t)) || classe === 'place' || classe === 'boundary';
        });

        const item = localidade || data[0];
        const addr = item.address || {};
        return {
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          cityName: addr.city || addr.town || addr.village || addr.hamlet || cidade,
          state: addr.state || '',
          country: addr.country || '',
          displayName: item.display_name || cidade
        };
      }
    } catch (err) {
      console.warn(`[GeoService] Geocodificação falhou para "${query}":`, err.message);
    }
  }

  console.warn(`[GeoService] Nenhum resultado encontrado para "${cidade}"`);
  return {
    lat: null,
    lng: null,
    cityName: cidade,
    state: '',
    country: '',
    displayName: cidade,
    naoEncontrada: true
  };
}

module.exports = { geocodificarCidade };

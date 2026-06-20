const OSRM_BASE = 'https://router.project-osrm.org/route/v1';

function formatarDistancia(metros) {
  if (metros >= 1000) return `${(metros / 1000).toFixed(1)} km`;
  return `${Math.round(metros)} m`;
}

function formatarTempo(segundos) {
  if (segundos < 60) return `${Math.round(segundos)} seg`;
  const min = Math.round(segundos / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = v => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function calcularDistanciasEntreLocais(locais) {
  if (!locais || locais.length < 2) return [];

  const coords = locais.map(l => `${l.longitude},${l.latitude}`).join(';');
  const url = `${OSRM_BASE}/driving/${coords}?annotations=distance,duration`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`OSRM HTTP ${resp.status}`);
    const data = await resp.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return calcularDistanciasFallback(locais);
    }

    const trechos = (data.routes[0].legs || []).map((leg, i) => ({
      de: locais[i].name,
      para: locais[i + 1]?.name || '',
      distanciaMetros: leg.distance,
      distanciaTexto: formatarDistancia(leg.distance),
      duracaoSegundos: leg.duration,
      duracaoTexto: formatarTempo(leg.duration)
    }));

    return trechos;
  } catch (err) {
    console.warn('[RouteService] OSRM falhou, usando fallback haversine:', err.message);
    return calcularDistanciasFallback(locais);
  }
}

function calcularDistanciasFallback(locais) {
  const trechos = [];
  for (let i = 0; i < locais.length - 1; i++) {
    const d = haversine(
      locais[i].latitude, locais[i].longitude,
      locais[i + 1].latitude, locais[i + 1].longitude
    );
    trechos.push({
      de: locais[i].name,
      para: locais[i + 1].name,
      distanciaMetros: d * 1000,
      distanciaTexto: `${d.toFixed(1)} km`,
      duracaoSegundos: null,
      duracaoTexto: ''
    });
  }
  return trechos;
}

async function calcularDistanciaEntreDois(lat1, lng1, lat2, lng2) {
  try {
    const url = `${OSRM_BASE}/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`OSRM HTTP ${resp.status}`);
    const data = await resp.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      return {
        distanciaKm: route.distance / 1000,
        distanciaTexto: formatarDistancia(route.distance),
        duracaoMin: Math.round(route.duration / 60),
        duracaoTexto: formatarTempo(route.duration)
      };
    }
  } catch {
    // fallback below
  }

  const d = haversine(lat1, lng1, lat2, lng2);
  return {
    distanciaKm: d,
    distanciaTexto: `${d.toFixed(1)} km`,
    duracaoMin: null,
    duracaoTexto: ''
  };
}

module.exports = { calcularDistanciasEntreLocais, calcularDistanciaEntreDois, haversine, formatarDistancia, formatarTempo };

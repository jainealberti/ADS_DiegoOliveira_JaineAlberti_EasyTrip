const OSRM_BASE = 'https://router.project-osrm.org/route/v1';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

function mapearPerfil() {
  return 'driving';
}

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

export async function calcularRota(pontos, meioTransporte) {
  if (!pontos || pontos.length < 2) return null;

  const perfil = mapearPerfil(meioTransporte);
  const coords = pontos.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `${OSRM_BASE}/${perfil}/${coords}?overview=full&geometries=geojson&steps=false`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`OSRM ${resp.status}`);
    const data = await resp.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return fallbackPolyline(pontos);
    }

    const rota = data.routes[0];
    const geometria = rota.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

    const trechos = (rota.legs || []).map((leg) => ({
      distancia: leg.distance,
      distanciaTexto: formatarDistancia(leg.distance),
      duracao: leg.duration,
      duracaoTexto: formatarTempo(leg.duration)
    }));

    return {
      geometria,
      distanciaTotal: rota.distance,
      distanciaTotalTexto: formatarDistancia(rota.distance),
      duracaoTotal: rota.duration,
      duracaoTotalTexto: formatarTempo(rota.duration),
      trechos,
      origem: 'osrm'
    };
  } catch (err) {
    console.warn('OSRM falhou, usando fallback:', err.message);
    return fallbackPolyline(pontos);
  }
}

function fallbackPolyline(pontos) {
  const geometria = pontos.map((p) => [parseFloat(p.lat), parseFloat(p.lng)]);
  let distanciaTotal = 0;
  const trechos = [];

  for (let i = 0; i < pontos.length - 1; i++) {
    const d = haversine(pontos[i], pontos[i + 1]);
    distanciaTotal += d;
    trechos.push({
      distancia: d,
      distanciaTexto: formatarDistancia(d),
      duracao: null,
      duracaoTexto: ''
    });
  }

  return {
    geometria,
    distanciaTotal,
    distanciaTotalTexto: formatarDistancia(distanciaTotal),
    duracaoTotal: null,
    duracaoTotalTexto: '',
    trechos,
    origem: 'linha_reta'
  };
}

export async function geocodificarCidade(cidade) {
  try {
    const resp = await fetch(
      `${NOMINATIM_BASE}/search?q=${encodeURIComponent(cidade)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'EasyTrip/1.0' } }
    );
    const data = await resp.json();
    if (data && data.length > 0) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
  } catch (err) {
    console.warn('Geocodificação falhou:', err.message);
  }
  return null;
}

function haversine(a, b) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

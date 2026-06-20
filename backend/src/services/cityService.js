const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

async function resolverCidade(cidade) {
  const tentativas = gerarTentativasBusca(cidade);

  for (const query of tentativas) {
    try {
      const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1&featuretype=city`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'EasyTrip/1.0 (travel-planner-academic)' }
      });
      const data = await resp.json();

      if (data && data.length > 0) {
        const resultado = selecionarMelhorResultado(data, cidade);
        if (resultado) return resultado;
      }
    } catch (err) {
      console.warn(`[CityService] Geocodificação falhou para "${query}":`, err.message);
    }
  }

  const fallbackSemTipo = await tentarBuscaSemFeatureType(cidade);
  if (fallbackSemTipo) return fallbackSemTipo;

  console.warn(`[CityService] Nenhum resultado encontrado para "${cidade}", usando busca genérica`);
  return {
    cidade: cidade,
    estado: '',
    pais: '',
    latitude: null,
    longitude: null,
    displayName: cidade,
    boundingBox: null,
    naoEncontrada: true,
  };
}

function gerarTentativasBusca(cidade) {
  const tentativas = [cidade];

  const semAcentos = cidade.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (semAcentos !== cidade) {
    tentativas.push(semAcentos);
  }

  if (!cidade.toLowerCase().includes('brasil') && !cidade.includes(',')) {
    tentativas.push(`${cidade}, Brasil`);
  }

  return tentativas;
}

function selecionarMelhorResultado(resultados, cidadeOriginal) {
  const cidadeLower = cidadeOriginal.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const tiposLocalidade = ['city', 'town', 'village', 'hamlet', 'municipality', 'administrative'];

  const localidades = resultados.filter(item => {
    const tipo = (item.type || '').toLowerCase();
    const classe = (item.class || '').toLowerCase();
    return tiposLocalidade.some(t => tipo.includes(t)) || classe === 'place' || classe === 'boundary';
  });

  const pool = localidades.length > 0 ? localidades : resultados;

  for (const item of pool) {
    const addr = item.address || {};
    const nomeResultado = (addr.city || addr.town || addr.village || addr.hamlet || item.display_name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (nomeResultado.includes(cidadeLower) || cidadeLower.includes(nomeResultado.split(',')[0].trim())) {
      return formatarResultado(item);
    }
  }

  if (pool.length > 0) {
    return formatarResultado(pool[0]);
  }

  return null;
}

function formatarResultado(item) {
  const addr = item.address || {};
  return {
    cidade: addr.city || addr.town || addr.village || addr.hamlet || item.name || '',
    estado: addr.state || '',
    pais: addr.country || '',
    latitude: parseFloat(item.lat),
    longitude: parseFloat(item.lon),
    displayName: item.display_name || '',
    boundingBox: item.boundingbox ? item.boundingbox.map(Number) : null,
    naoEncontrada: false,
  };
}

async function tentarBuscaSemFeatureType(cidade) {
  try {
    const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(cidade)}&format=json&limit=5&addressdetails=1`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'EasyTrip/1.0 (travel-planner-academic)' }
    });
    const data = await resp.json();

    if (data && data.length > 0) {
      return selecionarMelhorResultado(data, cidade);
    }
  } catch (err) {
    console.warn('[CityService] Busca sem featureType falhou:', err.message);
  }

  return null;
}

module.exports = { resolverCidade };

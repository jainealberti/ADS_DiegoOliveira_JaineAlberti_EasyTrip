const { resolverCidade } = require('./cityService');
const { buscarLugares } = require('./placesService');
const { buscarRestaurantes } = require('./restaurantService');
const { enriquecerLugares, buscarInfoCidade } = require('./wikipediaService');
const { organizarRoteiro, organizarRoteiroLocal } = require('./aiService');
const { calcularDistanciasEntreLocais, formatarDistancia, haversine } = require('./routeService');

async function gerarRoteiroCompleto(viagem) {
  const resultado = {
    etapas: [],
    erros: [],
  };

  try {
    // ETAPA 1: Resolver cidade
    console.log('[Itinerary] Etapa 1/8: Resolvendo cidade...');
    resultado.etapas.push('resolver_cidade');
    const cidadeInfo = await resolverCidade(viagem.destino);

    if (cidadeInfo.naoEncontrada || cidadeInfo.latitude === null) {
      console.warn(`[Itinerary] Cidade "${viagem.destino}" não encontrada no geocoding`);
      resultado.erros.push(`Não foi possível localizar "${viagem.destino}" no mapa. Verifique o nome da cidade e tente novamente.`);
      return { sucesso: false, resultado, cidadeInfo };
    }

    console.log(`[Itinerary] Cidade: ${cidadeInfo.cidade}, ${cidadeInfo.estado}, ${cidadeInfo.pais} (${cidadeInfo.latitude}, ${cidadeInfo.longitude})`);

    // ETAPA 2 e 3: Buscar lugares e restaurantes em paralelo
    console.log('[Itinerary] Etapa 2-3/8: Buscando lugares e restaurantes reais (Overpass API)...');
    resultado.etapas.push('buscar_lugares');
    resultado.etapas.push('buscar_restaurantes');

    let lugares = [];
    let restaurantes = [];
    try {
      [lugares, restaurantes] = await Promise.all([
        buscarLugares(cidadeInfo.latitude, cidadeInfo.longitude),
        buscarRestaurantes(cidadeInfo.latitude, cidadeInfo.longitude),
      ]);
    } catch (err) {
      console.error('[Itinerary] Erro nas buscas Overpass:', err.message);
    }

    console.log(`[Itinerary] ${lugares.length} lugares turísticos + ${restaurantes.length} restaurantes encontrados`);

    // ETAPA 4: Enriquecer com Wikipedia (não crítico)
    console.log('[Itinerary] Etapa 4/8: Enriquecendo descrições (Wikipedia)...');
    resultado.etapas.push('enriquecer_wikipedia');
    let lugaresEnriquecidos = lugares;
    try {
      lugaresEnriquecidos = await enriquecerLugares(lugares, cidadeInfo.cidade);
    } catch (err) {
      console.warn('[Itinerary] Wikipedia falhou (não crítico):', err.message);
    }

    // ETAPA 5: Validar lugares
    console.log('[Itinerary] Etapa 5/8: Validando lugares...');
    resultado.etapas.push('validar_lugares');
    const todosLugares = [...lugaresEnriquecidos, ...restaurantes];
    const lugaresValidos = validarLugares(todosLugares, cidadeInfo);
    console.log(`[Itinerary] ${lugaresValidos.length} lugares válidos após validação`);

    if (lugaresValidos.length === 0) {
      resultado.erros.push('Nenhum lugar real encontrado para esta cidade');
      return { sucesso: false, resultado, cidadeInfo };
    }

    // ETAPA 6: Organizar roteiro com IA
    console.log('[Itinerary] Etapa 6/8: Organizando roteiro com IA...');
    resultado.etapas.push('organizar_ia');
    const dadosViagem = {
      cidade: cidadeInfo.cidade,
      dias: viagem.quantidade_dias,
      preferencias: viagem.nome_preferencia,
      transporte: viagem.meio_transporte,
      orcamento: viagem.orcamento,
      detalhesExtras: viagem.detalhes_extra,
    };
    const roteiroIA = await organizarRoteiro(dadosViagem, lugaresValidos);

    // ETAPA 7: Validar saída da IA
    console.log('[Itinerary] Etapa 7/8: Validando saída da IA...');
    resultado.etapas.push('validar_ia');
    let roteiroValidado = validarSaidaIA(roteiroIA, lugaresValidos);

    if (!roteiroValidado) {
      console.warn('[Itinerary] Validação IA falhou, reorganizando localmente...');
      roteiroValidado = organizarRoteiroLocal(dadosViagem, lugaresValidos);
    }

    console.log(`[Itinerary] Roteiro final: ${roteiroValidado.days.length} dia(s)`);

    // ETAPA 8: Calcular deslocamentos (não crítico)
    console.log('[Itinerary] Etapa 8/8: Calculando deslocamentos (OSRM)...');
    resultado.etapas.push('calcular_deslocamentos');
    try {
      for (const dia of roteiroValidado.days) {
        if (dia.activities && dia.activities.length >= 2) {
          dia.activities = await calcularDeslocamentosAtividades(dia.activities);
        }
      }
    } catch (err) {
      console.warn('[Itinerary] OSRM falhou (não crítico):', err.message);
    }

    // Buscar info da cidade via Wikipedia (não crítico)
    let infoCidade = { summary: '', wikipediaUrl: '', title: cidadeInfo.cidade };
    try {
      infoCidade = await buscarInfoCidade(cidadeInfo.cidade);
    } catch (err) {
      console.warn('[Itinerary] Info cidade falhou (não crítico):', err.message);
    }

    return {
      sucesso: true,
      resultado,
      cidadeInfo,
      roteiro: roteiroValidado,
      infoCidade,
      lugaresValidos,
      totalLugaresEncontrados: todosLugares.length,
      totalAposValidacao: lugaresValidos.length,
    };
  } catch (err) {
    console.error('[Itinerary] ERRO FATAL:', err.message, err.stack);
    resultado.erros.push(err.message);
    return { sucesso: false, resultado, cidadeInfo: { cidade: viagem.destino, latitude: 0, longitude: 0 } };
  }
}

function validarLugares(lugares, cidadeInfo) {
  const MAX_DISTANCIA_KM = 50;

  return lugares.filter(lugar => {
    if (!lugar.name || lugar.name.trim().length < 2) return false;
    if (!lugar.latitude || !lugar.longitude) return false;
    if (lugar.latitude === 0 && lugar.longitude === 0) return false;
    if (isNaN(lugar.latitude) || isNaN(lugar.longitude)) return false;

    const distancia = haversine(
      cidadeInfo.latitude, cidadeInfo.longitude,
      lugar.latitude, lugar.longitude
    );
    if (distancia > MAX_DISTANCIA_KM) return false;

    return true;
  });
}

function validarSaidaIA(roteiroIA, lugaresValidos) {
  if (!roteiroIA || !roteiroIA.days || !Array.isArray(roteiroIA.days)) {
    console.warn('[Itinerary] Roteiro da IA inválido, usando organização local...');
    return null;
  }

  const mapaLugares = new Map();
  for (const lugar of lugaresValidos) {
    mapaLugares.set(lugar.id, lugar);
  }

  for (const dia of roteiroIA.days) {
    if (!dia.activities) {
      dia.activities = [];
      continue;
    }

    dia.activities = dia.activities.filter(ativ => {
      if (!ativ.placeId) {
        const lugarPorNome = lugaresValidos.find(
          l => l.name.toLowerCase().trim() === ativ.name?.toLowerCase().trim()
        );
        if (lugarPorNome) {
          ativ.placeId = lugarPorNome.id;
          ativ.latitude = lugarPorNome.latitude;
          ativ.longitude = lugarPorNome.longitude;
          ativ.address = lugarPorNome.address || ativ.address;
          return true;
        }
        const lugarParcial = lugaresValidos.find(
          l => l.name.toLowerCase().includes(ativ.name?.toLowerCase().trim()) ||
               ativ.name?.toLowerCase().trim().includes(l.name.toLowerCase())
        );
        if (lugarParcial) {
          ativ.placeId = lugarParcial.id;
          ativ.latitude = lugarParcial.latitude;
          ativ.longitude = lugarParcial.longitude;
          ativ.name = lugarParcial.name;
          ativ.address = lugarParcial.address || ativ.address;
          return true;
        }
        console.warn(`[Itinerary] Removendo lugar inventado: "${ativ.name}" (sem placeId válido)`);
        return false;
      }

      if (mapaLugares.has(ativ.placeId)) {
        const lugarReal = mapaLugares.get(ativ.placeId);
        ativ.latitude = lugarReal.latitude;
        ativ.longitude = lugarReal.longitude;
        ativ.name = lugarReal.name;
        if (!ativ.address || ativ.address === 'Endereço não disponível') {
          ativ.address = lugarReal.address || '';
        }
        return true;
      }

      console.warn(`[Itinerary] Removendo lugar com placeId inválido: "${ativ.name}" (${ativ.placeId})`);
      return false;
    });
  }

  roteiroIA.days = roteiroIA.days.filter(dia => dia.activities.length > 0);

  if (roteiroIA.days.length === 0) {
    console.warn('[Itinerary] Roteiro ficou vazio após validação IA');
    return null;
  }

  return roteiroIA;
}

async function calcularDeslocamentosAtividades(atividades) {
  if (atividades.length < 2) return atividades;

  const locais = atividades.map(a => ({
    name: a.name,
    latitude: a.latitude,
    longitude: a.longitude,
  }));

  try {
    const trechos = await calcularDistanciasEntreLocais(locais);

    for (let i = 0; i < atividades.length - 1; i++) {
      if (trechos[i]) {
        const t = trechos[i];
        atividades[i].distancia_proxima_km = parseFloat((t.distanciaMetros / 1000).toFixed(2));
        atividades[i].deslocamento_proximo = `${t.distanciaTexto}${t.duracaoTexto ? ' • ' + t.duracaoTexto : ''}`;
      }
    }
  } catch (err) {
    console.warn('[Itinerary] Erro ao calcular deslocamentos:', err.message);
  }

  return atividades;
}

module.exports = { gerarRoteiroCompleto };

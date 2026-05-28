import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { calcularRota, geocodificarCidade } from '../services/routeService';
import { useAuth } from '../context/AuthContext';
import {
  FiEdit, FiTrash2, FiPlus, FiClock, FiMapPin,
  FiDollarSign, FiSave, FiX, FiChevronDown, FiChevronRight,
  FiCheckSquare, FiSquare, FiArrowLeft, FiHome, FiInfo, FiNavigation
} from 'react-icons/fi';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const TIPO_CORES = {
  ponto_turistico: '#FF6B35', restaurante: '#e74c3c', cultural: '#8e44ad',
  natureza: '#27ae60', compras: '#f39c12', vida_noturna: '#2c3e50', experiencia_local: '#00b894'
};
const TIPO_EMOJI = {
  ponto_turistico: '📍', restaurante: '🍽️', cultural: '🏛️',
  natureza: '🌿', compras: '🛍️', vida_noturna: '🌙', experiencia_local: '⭐'
};
const TIPO_LABEL = {
  ponto_turistico: 'Ponto Turístico', restaurante: 'Restaurante', cultural: 'Cultural',
  natureza: 'Natureza', compras: 'Compras', vida_noturna: 'Vida Noturna', experiencia_local: 'Experiência Local'
};

function criarIconeNumerado(numero, cor, emoji) {
  return L.divIcon({
    className: 'marcador-numerado',
    html: `<div style="background:${cor};color:#fff;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.4);position:relative">
      ${numero}
      <span style="position:absolute;top:-12px;right:-10px;font-size:15px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3))">${emoji || ''}</span>
    </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -20]
  });
}

function criarIconeProximo(tipo) {
  const cor = TIPO_CORES[tipo] || '#f39c12';
  const emoji = TIPO_EMOJI[tipo] || '⭐';
  return L.divIcon({
    className: 'marcador-numerado',
    html: `<div style="background:#fff;color:${cor};width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid ${cor};box-shadow:0 2px 8px rgba(0,0,0,0.3)">${emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18]
  });
}

function coordenadaValida(lat, lng) {
  const la = parseFloat(lat);
  const ln = parseFloat(lng);
  return la && ln && la !== 0 && ln !== 0 && !isNaN(la) && !isNaN(ln);
}

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 400);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

function AjustarBounds({ pontos }) {
  const map = useMap();
  useEffect(() => {
    if (!pontos || pontos.length === 0) return;
    const timer = setTimeout(() => {
      map.invalidateSize();
      if (pontos.length === 1) {
        map.setView(pontos[0], 14);
      } else {
        const bounds = L.latLngBounds(pontos);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [pontos, map]);
  return null;
}

export default function DetalhesRoteiro() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [roteiro, setRoteiro] = useState(null);
  const [dias, setDias] = useState([]);
  const [metadados, setMetadados] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [diasAbertos, setDiasAbertos] = useState({});
  const [atividadeExpandida, setAtividadeExpandida] = useState(null);
  const [editando, setEditando] = useState(null);
  const [formEdit, setFormEdit] = useState({});
  const [novaAtividade, setNovaAtividade] = useState(null);
  const [editandoViagem, setEditandoViagem] = useState(false);
  const [formViagem, setFormViagem] = useState({});
  const [infoCidadeAberta, setInfoCidadeAberta] = useState(true);
  const [diaParaAdicionar, setDiaParaAdicionar] = useState(null);
  const [localParaAdicionar, setLocalParaAdicionar] = useState(null);
  const [diaFiltroMapa, setDiaFiltroMapa] = useState(0);
  const [rotaInfo, setRotaInfo] = useState(null);
  const [rotaGeometria, setRotaGeometria] = useState([]);
  const [centroMapa, setCentroMapa] = useState(null);
  const [pontosNoMapa, setPontosNoMapa] = useState([]);
  const [mapaCarregando, setMapaCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  useEffect(() => { carregarRoteiro(); }, [id]);

  useEffect(() => {
    if (dias.length > 0) {
      const todosAbertos = {};
      dias.forEach(d => { todosAbertos[d.dia] = true; });
      setDiasAbertos(todosAbertos);
    }
  }, [dias.length]);

  async function carregarRoteiro() {
    try {
      const res = await api.get(`/roteiro/${id}`);
      setRoteiro(res.data.roteiro);
      setDias(res.data.dias);
      setMetadados(res.data.metadados || {});
    } catch { setErro('Erro ao carregar roteiro.'); }
    finally { setCarregando(false); }
  }

  const todasAtividades = useMemo(() => dias.flatMap((d) => d.atividades), [dias]);

  useEffect(() => {
    async function prepararPontosMapa() {
      if (!roteiro || todasAtividades.length === 0) {
        setMapaCarregando(false);
        return;
      }

      setMapaCarregando(true);

      const comCoords = todasAtividades.filter(a => coordenadaValida(a.lat, a.lng));

      if (comCoords.length > 0) {
        const pontos = comCoords.map(a => ({
          ...a,
          latNum: parseFloat(a.lat),
          lngNum: parseFloat(a.lng)
        }));
        setPontosNoMapa(pontos);

        const metaCentro = metadados.centro;
        if (metaCentro && coordenadaValida(metaCentro.lat, metaCentro.lng)) {
          setCentroMapa([parseFloat(metaCentro.lat), parseFloat(metaCentro.lng)]);
        } else {
          const avgLat = pontos.reduce((s, p) => s + p.latNum, 0) / pontos.length;
          const avgLng = pontos.reduce((s, p) => s + p.lngNum, 0) / pontos.length;
          setCentroMapa([avgLat, avgLng]);
        }
      } else {
        let centro = null;
        const metaCentro = metadados.centro;
        if (metaCentro && coordenadaValida(metaCentro.lat, metaCentro.lng)) {
          centro = [parseFloat(metaCentro.lat), parseFloat(metaCentro.lng)];
        }

        if (!centro && roteiro.destino) {
          const coords = await geocodificarCidade(roteiro.destino);
          if (coords) centro = coords;
        }

        if (!centro) centro = [-15.78, -47.93];

        setCentroMapa(centro);

        const pontos = todasAtividades.map((a, i) => {
          const angulo = (2 * Math.PI * i) / todasAtividades.length;
          const raio = 0.008 + (i % 3) * 0.004;
          return {
            ...a,
            latNum: centro[0] + raio * Math.cos(angulo),
            lngNum: centro[1] + raio * Math.sin(angulo),
            coordAproximada: true
          };
        });
        setPontosNoMapa(pontos);
      }

      setMapaCarregando(false);
    }

    prepararPontosMapa();
  }, [todasAtividades, roteiro, metadados]);

  const pontosFiltrados = useMemo(
    () => diaFiltroMapa === 0 ? pontosNoMapa : pontosNoMapa.filter(a => a.dia === diaFiltroMapa),
    [pontosNoMapa, diaFiltroMapa]
  );

  const buscarRota = useCallback(async () => {
    if (pontosFiltrados.length < 2) {
      setRotaInfo(null);
      setRotaGeometria([]);
      return;
    }
    const hasAproximada = pontosFiltrados.some(p => p.coordAproximada);
    if (hasAproximada) {
      setRotaInfo(null);
      setRotaGeometria([]);
      return;
    }
    const pontos = pontosFiltrados.map(a => ({ lat: a.latNum, lng: a.lngNum }));
    const resultado = await calcularRota(pontos, metadados.meio_transporte);
    if (resultado) {
      setRotaGeometria(resultado.geometria);
      setRotaInfo(resultado);
    }
  }, [pontosFiltrados, metadados.meio_transporte]);

  useEffect(() => { buscarRota(); }, [buscarRota]);

  const boundsPoints = useMemo(() => {
    const pts = pontosFiltrados.map(a => [a.latNum, a.lngNum]);
    if (pts.length === 0 && centroMapa) pts.push(centroMapa);
    return pts;
  }, [pontosFiltrados, centroMapa]);

  const tiposNoMapa = useMemo(() => {
    const tipos = new Set();
    pontosFiltrados.forEach(a => { if (a.tipo) tipos.add(a.tipo); });
    return [...tipos];
  }, [pontosFiltrados]);

  function toggleDia(dia) { setDiasAbertos(p => ({ ...p, [dia]: !p[dia] })); }
  function expandirTodos() { const t = {}; dias.forEach(d => { t[d.dia] = true; }); setDiasAbertos(t); }
  function recolherTodos() { setDiasAbertos({}); }
  function toggleDetalheAtividade(idAtiv) { setAtividadeExpandida(p => p === idAtiv ? null : idAtiv); }

  function iniciarEdicaoViagem() {
    setEditandoViagem(true);
    setFormViagem({ destino: roteiro.destino || '', quantidade_dias: roteiro.quantidade_dias || '', orcamento: roteiro.orcamento || '' });
  }
  async function salvarViagem() {
    try {
      await api.put(`/viagem/${roteiro.fk_viagem_id_viagem}`, formViagem);
      setSucesso('Dados da viagem atualizados!'); setEditandoViagem(false); carregarRoteiro();
      setTimeout(() => setSucesso(''), 2000);
    } catch { setErro('Erro ao salvar viagem.'); }
  }

  function iniciarEdicao(atividade) {
    setEditando(atividade.id_atividade);
    setFormEdit({ nome_atividade: atividade.nome_atividade || '', descricao: atividade.descricao || '', local: atividade.local || '', horario: atividade.horario || '', custo_estimado: atividade.custo_estimado || 0 });
  }
  async function salvarEdicao(id_atividade) {
    try {
      await api.put(`/atividade/editar/${id_atividade}`, formEdit);
      setSucesso('Atividade atualizada!'); setEditando(null); carregarRoteiro();
      setTimeout(() => setSucesso(''), 2000);
    } catch { setErro('Erro ao salvar atividade.'); }
  }

  async function toggleRealizada(atividade) {
    try {
      await api.patch(`/atividade/realizada/${atividade.id_atividade}`, { realizada: !atividade.realizada });
      setDias(prev => prev.map(d => ({ ...d, atividades: d.atividades.map(a => a.id_atividade === atividade.id_atividade ? { ...a, realizada: !atividade.realizada } : a) })));
    } catch { setErro('Erro ao atualizar atividade.'); }
  }

  async function excluirAtividade(id_atividade) {
    if (!window.confirm('Excluir esta atividade?')) return;
    try {
      await api.delete(`/atividade/excluir/${id_atividade}`);
      setSucesso('Atividade excluída!'); carregarRoteiro();
      setTimeout(() => setSucesso(''), 2000);
    } catch { setErro('Erro ao excluir atividade.'); }
  }

  function iniciarNovaAtividade(dia) {
    setNovaAtividade({ fk_roteiro_id_roteiro: parseInt(id), dia, nome_atividade: '', descricao: '', local: '', horario: '09:00', custo_estimado: 0 });
    setDiasAbertos(p => ({ ...p, [dia]: true }));
  }
  async function salvarNovaAtividade() {
    try {
      await api.post('/atividade/adicionar', novaAtividade);
      setSucesso('Atividade adicionada!'); setNovaAtividade(null); carregarRoteiro();
      setTimeout(() => setSucesso(''), 2000);
    } catch { setErro('Erro ao adicionar atividade.'); }
  }

  function abrirSeletorDia(local) {
    setLocalParaAdicionar(local);
    setDiaParaAdicionar(dias.length > 0 ? dias[0].dia : 1);
  }
  async function confirmarAdicionarLocal() {
    if (!localParaAdicionar) return;
    try {
      await api.post('/atividade/adicionar', {
        fk_roteiro_id_roteiro: parseInt(id), dia: diaParaAdicionar,
        nome_atividade: localParaAdicionar.nome,
        descricao: localParaAdicionar.descricao || '',
        local: localParaAdicionar.distancia || '',
        horario: '14:00', custo_estimado: 0
      });
      setSucesso(`"${localParaAdicionar.nome}" adicionado ao Dia ${diaParaAdicionar}!`);
      setLocalParaAdicionar(null);
      carregarRoteiro();
      setTimeout(() => setSucesso(''), 3000);
    } catch { setErro('Erro ao adicionar local.'); }
  }

  if (carregando) return <div className="loading"><div className="spinner" /></div>;
  if (!roteiro) return <div className="container"><p>Roteiro não encontrado.</p></div>;

  const totalAtividades = todasAtividades.length;
  const realizadas = todasAtividades.filter(a => a.realizada).length;
  const infoCidade = metadados.info_cidade || {};
  const locaisProximos = metadados.locais_proximos || [];
  const temCoordAproximada = pontosFiltrados.some(p => p.coordAproximada);
  const fontesInfo = metadados.fontes_dados || {};
  const totalLugaresEncontrados = metadados.total_lugares_encontrados || 0;
  const totalLugaresValidados = metadados.total_lugares_validados || 0;

  let contadorGlobal = 0;

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1>{roteiro.titulo}</h1>
          <p>{roteiro.descricao}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}><FiHome /> Menu</button>
          <button className="btn btn-secondary" onClick={() => navigate(`/viagens/${roteiro.fk_viagem_id_viagem}`)}><FiArrowLeft /> Voltar</button>
        </div>
      </div>

      {erro && <div className="alert alert-erro">{erro}</div>}
      {sucesso && <div className="alert alert-sucesso">{sucesso}</div>}

      {localParaAdicionar && (
        <div className="modal-overlay" onClick={() => setLocalParaAdicionar(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Adicionar &quot;{localParaAdicionar.nome}&quot; ao roteiro</h3>
            <p>Escolha o dia:</p>
            <div className="dia-selector">
              {dias.map(d => (
                <button key={d.dia} type="button"
                  className={`pref-chip ${diaParaAdicionar === d.dia ? 'pref-chip-active' : ''}`}
                  onClick={() => setDiaParaAdicionar(d.dia)}
                >Dia {d.dia}</button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={confirmarAdicionarLocal}><FiPlus /> Adicionar ao Dia {diaParaAdicionar}</button>
              <button className="btn btn-secondary" onClick={() => setLocalParaAdicionar(null)}><FiX /> Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {metadados.mensagem_pessoal && (
        <div className="welcome-banner">
          <h2>Olá, {usuario?.nome}!</h2>
          <p className="welcome-msg">{metadados.mensagem_pessoal}</p>
          <p className="welcome-context">
            Criei este roteiro considerando {roteiro.destino}, {roteiro.quantidade_dias} dia(s)
            {metadados.preferencias ? `, preferências por ${metadados.preferencias}` : ''}
            {metadados.meio_transporte ? `, transporte de ${metadados.meio_transporte}` : ''}
            {roteiro.orcamento ? `, orçamento de R$${parseFloat(roteiro.orcamento).toFixed(2)}` : ''}
            {metadados.detalhes_extra ? ` e seus detalhes especiais` : ''}.
          </p>
          {totalLugaresEncontrados > 0 && (
            <div className="dados-reais-badge">
              <span className="badge-real">100% Dados Reais</span>
              <span className="badge-info">
                {totalLugaresEncontrados} lugar(es) encontrado(s) | {totalLugaresValidados} validado(s)
                {fontesInfo.lugares && ` | Fonte: ${fontesInfo.lugares}`}
                {fontesInfo.rotas && ` | Rotas: ${fontesInfo.rotas}`}
              </span>
            </div>
          )}
          {dias.length > 0 && (() => {
            const custoTotal = dias.reduce((total, d) => total + d.atividades.reduce((acc, a) => acc + (parseFloat(a.custo_estimado) || 0), 0), 0);
            const totalAtividades = dias.reduce((acc, d) => acc + d.atividades.length, 0);
            const gratuitas = dias.reduce((acc, d) => acc + d.atividades.filter(a => parseFloat(a.custo_estimado) === 0).length, 0);
            return (
              <div className="resumo-custos" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.8rem', padding: '0.8rem 1rem', background: '#f0faf4', borderRadius: '10px', border: '1px solid #d4efdf' }}>
                <span style={{ fontWeight: '600', color: '#27ae60', fontSize: '0.9rem' }}>💰 Custo total estimado: R$ {custoTotal.toFixed(2)}</span>
                <span style={{ color: '#636e72', fontSize: '0.85rem' }}>| {totalAtividades} atividades</span>
                <span style={{ color: '#636e72', fontSize: '0.85rem' }}>| {gratuitas} gratuitas</span>
                {roteiro.orcamento && custoTotal > 0 && (
                  <span style={{ color: custoTotal <= parseFloat(roteiro.orcamento) ? '#27ae60' : '#e74c3c', fontSize: '0.85rem', fontWeight: '500' }}>
                    | {custoTotal <= parseFloat(roteiro.orcamento) ? '✅ Dentro do orçamento' : '⚠️ Acima do orçamento'}
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {infoCidade.historia && (
        <div className="cidade-info-panel">
          <div className="cidade-info-header" onClick={() => setInfoCidadeAberta(!infoCidadeAberta)}>
            <span><FiInfo /> Sobre {roteiro.destino}</span>
            {infoCidadeAberta ? <FiChevronDown /> : <FiChevronRight />}
          </div>
          {infoCidadeAberta && (
            <div className="cidade-info-body">
              <div className="cidade-info-grid">
                <div><strong>Sobre a cidade</strong><p>{infoCidade.historia}</p></div>
                {infoCidade.curiosidades && <div><strong>Curiosidades</strong><p>{infoCidade.curiosidades}</p></div>}
                {infoCidade.clima && <div><strong>Clima</strong><p>{infoCidade.clima}</p></div>}
                {infoCidade.populacao && <div><strong>População</strong><p>{infoCidade.populacao}</p></div>}
                {infoCidade.principais_atracoes && <div><strong>Principais Atrações</strong><p>{infoCidade.principais_atracoes}</p></div>}
                {infoCidade.gastronomia && <div><strong>Gastronomia</strong><p>{infoCidade.gastronomia}</p></div>}
                {infoCidade.dica_geral && <div><strong>Dica</strong><p>{infoCidade.dica_geral}</p></div>}
              </div>
              {infoCidade.wikipediaUrl && (
                <p style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                  <a href={infoCidade.wikipediaUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#3498db' }}>
                    Saiba mais na Wikipedia
                  </a>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========== MAPA ========== */}
      <div className="mapa-section">
        <h3><FiMapPin /> Mapa do Roteiro</h3>

        {dias.length > 0 && (
          <div className="mapa-filtros">
            <span className="mapa-filtro-label">Visualizar:</span>
            <button className={`mapa-filtro-btn ${diaFiltroMapa === 0 ? 'mapa-filtro-ativo' : ''}`} onClick={() => setDiaFiltroMapa(0)}>Todos</button>
            {dias.map(d => (
              <button key={d.dia} className={`mapa-filtro-btn ${diaFiltroMapa === d.dia ? 'mapa-filtro-ativo' : ''}`} onClick={() => setDiaFiltroMapa(d.dia)}>Dia {d.dia}</button>
            ))}
          </div>
        )}

        {rotaInfo && (
          <div className="rota-resumo">
            <span>Distância: <strong>{rotaInfo.distanciaTotalTexto}</strong></span>
            {rotaInfo.duracaoTotalTexto && <span>Tempo: <strong>{rotaInfo.duracaoTotalTexto}</strong></span>}
            <span><strong>{pontosFiltrados.length}</strong> ponto(s)</span>
            {rotaInfo.origem === 'linha_reta' && <small>(linha reta)</small>}
          </div>
        )}

        {!rotaInfo && pontosFiltrados.length > 0 && (
          <div className="rota-resumo">
            <span><strong>{pontosFiltrados.length}</strong> ponto(s) no mapa</span>
            {temCoordAproximada && <small>(posições aproximadas - gere um novo roteiro para coordenadas reais)</small>}
          </div>
        )}

        {tiposNoMapa.length > 0 && (
          <div className="mapa-legenda">
            {tiposNoMapa.map(tipo => (
              <span key={tipo} className="mapa-legenda-item">
                <span className="mapa-legenda-cor" style={{ background: TIPO_CORES[tipo] || '#FF6B35' }}>{TIPO_EMOJI[tipo] || '📍'}</span>
                {TIPO_LABEL[tipo] || tipo}
              </span>
            ))}
          </div>
        )}

        {mapaCarregando ? (
          <div className="mapa-fallback">
            <div className="spinner" />
            <p>Carregando mapa de {roteiro.destino}...</p>
          </div>
        ) : centroMapa ? (
          <div className="mapa-container-leaflet" key={`map-${centroMapa[0]}-${centroMapa[1]}`}>
            <MapContainer
              center={centroMapa}
              zoom={pontosFiltrados.length > 0 ? 13 : 12}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <InvalidateSize />
              <AjustarBounds pontos={boundsPoints} />

              {pontosFiltrados.map((a, i) => {
                const cor = TIPO_CORES[a.tipo] || '#FF6B35';
                const emoji = TIPO_EMOJI[a.tipo] || '📍';
                const trecho = rotaInfo?.trechos?.[i];
                return (
                  <Marker key={a.id_atividade || `pt-${i}`} position={[a.latNum, a.lngNum]} icon={criarIconeNumerado(i + 1, cor, emoji)}>
                    <Popup maxWidth={280}>
                      <div style={{ minWidth: '200px' }}>
                        <div style={{ background: cor, color: '#fff', padding: '6px 10px', borderRadius: '6px', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 700 }}>
                          {emoji} {a.nome_atividade}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#444', lineHeight: '1.6' }}>
                          <span style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: '4px', marginRight: '4px' }}>Dia {a.dia}</span>
                          {a.horario && <span style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: '4px', marginRight: '4px' }}>🕐 {a.horario}</span>}
                          {a.tipo && <span style={{ background: cor + '20', color: cor, padding: '2px 6px', borderRadius: '4px' }}>{TIPO_LABEL[a.tipo] || a.tipo}</span>}
                        </div>
                        {a.local && <p style={{ margin: '4px 0 2px', fontSize: '0.78rem', color: '#636e72' }}><FiMapPin size={10} /> {a.local}</p>}
                        {a.tempo_visita && <p style={{ margin: '2px 0', fontSize: '0.78rem', color: '#636e72' }}>Visita: {a.tempo_visita}</p>}
                        <p style={{ margin: '2px 0', fontSize: '0.78rem', color: parseFloat(a.custo_estimado) > 0 ? '#27ae60' : '#7f8c8d', fontWeight: '500' }}>
                          {parseFloat(a.custo_estimado) > 0 ? `💰 R$ ${parseFloat(a.custo_estimado).toFixed(2)}` : '✅ Gratuito'}
                        </p>
                        {trecho && trecho.distanciaTexto && (
                          <p style={{ margin: '4px 0', fontSize: '0.78rem', color: '#2980b9', background: '#eaf2f8', padding: '3px 6px', borderRadius: '4px' }}>
                            Próximo: {trecho.distanciaTexto}{trecho.duracaoTexto ? ` - ${trecho.duracaoTexto}` : ''}
                          </p>
                        )}
                        {a.descricao && <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#555', lineHeight: '1.4', borderTop: '1px solid #eee', paddingTop: '4px' }}>{a.descricao.substring(0, 150)}{a.descricao.length > 150 ? '...' : ''}</p>}
                        {a.coordAproximada && <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#b2bec3', fontStyle: 'italic' }}>Posição aproximada</p>}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}


              {rotaGeometria.length > 1 && (
                <Polyline positions={rotaGeometria} pathOptions={{ color: '#FF6B35', weight: 4, opacity: 0.7, dashArray: '10, 6' }} />
              )}
            </MapContainer>
          </div>
        ) : (
          <div className="mapa-fallback">
            <FiMapPin size={32} />
            <p>Não foi possível carregar o mapa.</p>
          </div>
        )}

      </div>

      {/* Painel info viagem */}
      <div className="roteiro-info-panel">
        {editandoViagem ? (
          <div className="roteiro-info-edit">
            <div className="edit-row">
              <div className="input-group"><input type="text" placeholder="Destino" value={formViagem.destino} onChange={e => setFormViagem({ ...formViagem, destino: e.target.value })} /></div>
              <div className="input-group"><input type="number" placeholder="Dias" value={formViagem.quantidade_dias} onChange={e => setFormViagem({ ...formViagem, quantidade_dias: parseInt(e.target.value) || '' })} min="1" /></div>
              <div className="input-group"><input type="number" placeholder="Orçamento R$" value={formViagem.orcamento} onChange={e => setFormViagem({ ...formViagem, orcamento: e.target.value })} step="0.01" /></div>
            </div>
            <div className="edit-actions">
              <button className="btn btn-sm btn-primary" onClick={salvarViagem}><FiSave /> Salvar</button>
              <button className="btn btn-sm btn-secondary" onClick={() => setEditandoViagem(false)}><FiX /> Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="roteiro-info-display">
            <div className="roteiro-info-items">
              <span><FiMapPin /> {roteiro.destino}</span>
              <span><FiClock /> {roteiro.quantidade_dias} dia(s)</span>
              {roteiro.orcamento && <span><FiDollarSign /> R$ {parseFloat(roteiro.orcamento).toFixed(2)}</span>}
            </div>
            <div className="roteiro-info-stats">
              <span className="tag">{realizadas}/{totalAtividades} realizadas</span>
              <button className="btn-icon" onClick={iniciarEdicaoViagem} title="Editar viagem"><FiEdit /></button>
            </div>
          </div>
        )}
      </div>

      {/* Cards de dias */}
      <div className="accordion-controls">
        <button className="btn btn-sm btn-secondary" onClick={expandirTodos}>Expandir todos</button>
        <button className="btn btn-sm btn-secondary" onClick={recolherTodos}>Recolher todos</button>
      </div>

      <div className="dias-grid">
        {dias.map(diaObj => {
          const aberto = diasAbertos[diaObj.dia] || false;
          const realizadasDia = diaObj.atividades.filter(a => a.realizada).length;
          const custoTotalDia = diaObj.atividades.reduce((acc, a) => acc + (parseFloat(a.custo_estimado) || 0), 0);
          return (
            <div key={diaObj.dia} className="accordion-item">
              <div className="accordion-header" onClick={() => toggleDia(diaObj.dia)}>
                <div className="accordion-title">
                  {aberto ? <FiChevronDown size={20} /> : <FiChevronRight size={20} />}
                  <h2>Dia {diaObj.dia}</h2>
                  <span className="accordion-badge">{realizadasDia}/{diaObj.atividades.length}</span>
                  {custoTotalDia > 0 && <span className="accordion-badge" style={{ background: '#27ae60', marginLeft: '0.4rem' }}>💰 R$ {custoTotalDia.toFixed(2)}</span>}
                </div>
                <button className="btn btn-sm btn-primary" onClick={e => { e.stopPropagation(); iniciarNovaAtividade(diaObj.dia); }}><FiPlus /> Adicionar</button>
              </div>
              {aberto && (
                <div className="accordion-body">
                  <div className="atividades-list">
                    {diaObj.atividades.map(ativ => {
                      contadorGlobal++;
                      const numAtiv = contadorGlobal;
                      const expandida = atividadeExpandida === ativ.id_atividade;
                      return (
                        <div key={ativ.id_atividade} className={`atividade-card ${ativ.realizada ? 'atividade-realizada' : ''}`}>
                          {editando === ativ.id_atividade ? (
                            <div className="atividade-edit">
                              <input type="text" placeholder="Nome da atividade" value={formEdit.nome_atividade} onChange={e => setFormEdit({ ...formEdit, nome_atividade: e.target.value })} />
                              <input type="text" placeholder="Descrição" value={formEdit.descricao} onChange={e => setFormEdit({ ...formEdit, descricao: e.target.value })} />
                              <input type="text" placeholder="Local" value={formEdit.local} onChange={e => setFormEdit({ ...formEdit, local: e.target.value })} />
                              <div className="edit-row">
                                <input type="time" value={formEdit.horario} onChange={e => setFormEdit({ ...formEdit, horario: e.target.value })} />
                                <input type="number" placeholder="Custo" value={formEdit.custo_estimado} onChange={e => setFormEdit({ ...formEdit, custo_estimado: parseFloat(e.target.value) || 0 })} step="0.01" />
                              </div>
                              <div className="edit-actions">
                                <button className="btn btn-sm btn-primary" onClick={() => salvarEdicao(ativ.id_atividade)}><FiSave /> Salvar</button>
                                <button className="btn btn-sm btn-secondary" onClick={() => setEditando(null)}><FiX /> Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button className="checkbox-btn" onClick={() => toggleRealizada(ativ)} title={ativ.realizada ? 'Marcar como pendente' : 'Marcar como realizada'}>
                                {ativ.realizada ? <FiCheckSquare size={22} className="check-done" /> : <FiSquare size={22} />}
                              </button>
                              <div className={`atividade-info ${ativ.realizada ? 'info-riscado' : ''}`}>
                                <div className="atividade-header-row" onClick={() => toggleDetalheAtividade(ativ.id_atividade)}>
                                  <span className="ativ-numero" style={{ background: TIPO_CORES[ativ.tipo] || '#FF6B35' }}>{numAtiv}</span>
                                  <h4>{TIPO_EMOJI[ativ.tipo] || '📍'} {ativ.nome_atividade || 'Atividade'}</h4>
                                  {expandida ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
                                </div>
                                <div className="atividade-meta">
                                  {ativ.horario && <span><FiClock /> {ativ.horario}</span>}
                                  {ativ.local && <span><FiMapPin /> {ativ.local}</span>}
                                  <span style={{ color: parseFloat(ativ.custo_estimado) > 0 ? '#27ae60' : '#7f8c8d' }}>
                                    <FiDollarSign /> {parseFloat(ativ.custo_estimado) > 0 ? `R$ ${parseFloat(ativ.custo_estimado).toFixed(2)}` : 'Gratuito'}
                                  </span>
                                  {ativ.tempo_visita && <span>🕐 {ativ.tempo_visita}</span>}
                                  {ativ.deslocamento_proximo && <span className="deslocamento-badge">🚗 {ativ.deslocamento_proximo}</span>}
                                  {ativ.tipo && <span className="tag" style={{ background: TIPO_CORES[ativ.tipo] || '#FF6B35', color: '#fff' }}>{ativ.tipo.replace(/_/g, ' ')}</span>}
                                </div>
                                {expandida && ativ.descricao && (
                                  <div className="atividade-detalhes">
                                    <p>{ativ.descricao}</p>
                                  </div>
                                )}
                              </div>
                              <div className="atividade-actions">
                                <button className="btn-icon" onClick={() => iniciarEdicao(ativ)} title="Editar"><FiEdit /></button>
                                <button className="btn-icon btn-icon-danger" onClick={() => excluirAtividade(ativ.id_atividade)} title="Excluir"><FiTrash2 /></button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                    {novaAtividade && novaAtividade.dia === diaObj.dia && (
                      <div className="atividade-card atividade-nova">
                        <div className="atividade-edit">
                          <input type="text" placeholder="Nome da atividade" value={novaAtividade.nome_atividade} onChange={e => setNovaAtividade({ ...novaAtividade, nome_atividade: e.target.value })} />
                          <input type="text" placeholder="Descrição" value={novaAtividade.descricao} onChange={e => setNovaAtividade({ ...novaAtividade, descricao: e.target.value })} />
                          <input type="text" placeholder="Local" value={novaAtividade.local} onChange={e => setNovaAtividade({ ...novaAtividade, local: e.target.value })} />
                          <div className="edit-row">
                            <input type="time" value={novaAtividade.horario} onChange={e => setNovaAtividade({ ...novaAtividade, horario: e.target.value })} />
                            <input type="number" placeholder="Custo" value={novaAtividade.custo_estimado} onChange={e => setNovaAtividade({ ...novaAtividade, custo_estimado: parseFloat(e.target.value) || 0 })} step="0.01" />
                          </div>
                          <div className="edit-actions">
                            <button className="btn btn-sm btn-primary" onClick={salvarNovaAtividade}><FiSave /> Salvar</button>
                            <button className="btn btn-sm btn-secondary" onClick={() => setNovaAtividade(null)}><FiX /> Cancelar</button>
                          </div>
                        </div>
                      </div>
                    )}
                    {diaObj.atividades.length === 0 && !novaAtividade && <p className="empty-dia">Nenhuma atividade neste dia.</p>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {dias.length === 0 && <div className="empty-state-small"><p>Nenhuma atividade encontrada neste roteiro.</p></div>}

      {locaisProximos.length > 0 && (
        <div className="locais-proximos">
          <h4><FiNavigation /> Locais próximos para explorar</h4>
          <div className="locais-grid">
            {locaisProximos.map((l, i) => (
              <div key={i} className="local-card">
                <div className="local-info">
                  <strong>{TIPO_EMOJI[l.tipo] || '*'} {l.nome}</strong>
                  <span className="tag" style={{ background: TIPO_CORES[l.tipo] || '#f39c12', color: '#fff' }}>{TIPO_LABEL[l.tipo] || l.tipo}</span>
                  <small>{l.distancia}</small>
                  <p>{l.descricao}</p>
                  {l.dica && <p className="local-dica">{l.dica}</p>}
                </div>
                <button className="btn btn-sm btn-primary" onClick={() => abrirSeletorDia(l)}>
                  <FiPlus /> Adicionar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

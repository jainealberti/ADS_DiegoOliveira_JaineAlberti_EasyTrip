import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { calcularRota, geocodificarCidade } from '../services/routeService';
import { useAuth } from '../context/AuthContext';
import {
  FiEdit, FiTrash2, FiPlus, FiClock, FiMapPin,
  FiDollarSign, FiSave, FiX, FiChevronDown, FiChevronRight,
  FiCheckSquare, FiSquare, FiArrowLeft, FiHome, FiInfo, FiNavigation,
  FiDownload, FiShare2, FiCopy, FiExternalLink, FiSun, FiMail, FiSend,
  FiThermometer, FiGlobe, FiUsers, FiCamera, FiCalendar, FiMap,
  FiCompass, FiCheckCircle, FiCoffee
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

function SkeletonBlock({ width = '100%', height = '20px', radius = '8px' }) {
  return <div className="rt-skeleton" style={{ width, height, borderRadius: radius }} />;
}

const GRADIENTES = {
  ponto_turistico: 'linear-gradient(135deg, #FF6B35, #ff9a6c)',
  restaurante: 'linear-gradient(135deg, #e74c3c, #f39c12)',
  cultural: 'linear-gradient(135deg, #8e44ad, #3498db)',
  natureza: 'linear-gradient(135deg, #27ae60, #2ecc71)',
  compras: 'linear-gradient(135deg, #f39c12, #e67e22)',
  vida_noturna: 'linear-gradient(135deg, #2c3e50, #34495e)',
  experiencia_local: 'linear-gradient(135deg, #00b894, #00cec9)',
  default: 'linear-gradient(135deg, #667eea, #764ba2)',
};

function ImageFallback({ nome, tipo, size = 'medium' }) {
  const bg = GRADIENTES[tipo] || GRADIENTES.default;
  const emoji = TIPO_EMOJI[tipo] || '📍';
  return (
    <div className={`rt-img-fallback rt-img-fallback-${size}`} style={{ background: bg }}>
      <span className="rt-fallback-emoji">{emoji}</span>
      <span className="rt-fallback-nome">{nome}</span>
      <span className="rt-fallback-label">Imagem não disponível</span>
    </div>
  );
}

function SmartImage({ src, alt, tipo, size = 'medium', className = '' }) {
  const [failed, setFailed] = useState(false);
  const isValid = src && typeof src === 'string' && src.startsWith('http');
  if (!isValid || failed) return <ImageFallback nome={alt} tipo={tipo} size={size} />;
  return (
    <img src={src} alt={alt} loading="lazy" className={className}
      onError={() => setFailed(true)} />
  );
}

function RatingStars({ rating }) {
  if (!rating || rating <= 0) return null;
  const full = Math.floor(rating);
  const half = rating - full >= 0.3;
  return (
    <div className="rt-rating">
      {[...Array(5)].map((_, i) => (
        <span key={i} className={`rt-star ${i < full ? 'rt-star-full' : (i === full && half ? 'rt-star-half' : '')}`}>★</span>
      ))}
      <span className="rt-rating-num">{Number(rating).toFixed(1)}</span>
    </div>
  );
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
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [modalCompartilhar, setModalCompartilhar] = useState(null);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [emailDestino, setEmailDestino] = useState('');
  const [mensagemEmail, setMensagemEmail] = useState('');
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState(false);

  const [imagens, setImagens] = useState({});
  const [imagensCarregando, setImagensCarregando] = useState(false);

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
      carregarImagens();
    } catch { setErro('Erro ao carregar roteiro.'); }
    finally { setCarregando(false); }
  }

  async function carregarImagens() {
    setImagensCarregando(true);
    try {
      const res = await api.get(`/roteiro/${id}/imagens`);
      setImagens(res.data || {});
    } catch (err) {
      console.warn('Imagens indisponíveis:', err.message);
    } finally {
      setImagensCarregando(false);
    }
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
        const pontos = comCoords.map(a => ({ ...a, latNum: parseFloat(a.lat), lngNum: parseFloat(a.lng) }));
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
          return { ...a, latNum: centro[0] + raio * Math.cos(angulo), lngNum: centro[1] + raio * Math.sin(angulo), coordAproximada: true };
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
    if (pontosFiltrados.length < 2) { setRotaInfo(null); setRotaGeometria([]); return; }
    if (pontosFiltrados.some(p => p.coordAproximada)) { setRotaInfo(null); setRotaGeometria([]); return; }
    const pontos = pontosFiltrados.map(a => ({ lat: a.latNum, lng: a.lngNum }));
    const resultado = await calcularRota(pontos, metadados.meio_transporte);
    if (resultado) { setRotaGeometria(resultado.geometria); setRotaInfo(resultado); }
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
        local: localParaAdicionar.endereco || localParaAdicionar.distancia || '',
        horario: '14:00', custo_estimado: localParaAdicionar.valor_medio || 0,
      });
      setSucesso(`"${localParaAdicionar.nome}" adicionado ao Dia ${diaParaAdicionar}!`);
      setLocalParaAdicionar(null);
      carregarRoteiro();
      setTimeout(() => setSucesso(''), 3000);
    } catch { setErro('Erro ao adicionar local.'); }
  }

  async function baixarPDF() {
    setGerandoPDF(true);
    try {
      const res = await api.get(`/roteiro/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      const destino = roteiro?.destino?.toLowerCase().replace(/\s+/g, '-') || 'roteiro';
      link.href = url;
      link.setAttribute('download', `easytrip-roteiro-${destino}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSucesso('PDF baixado com sucesso!');
      setTimeout(() => setSucesso(''), 3000);
    } catch {
      setErro('Não foi possível gerar o PDF. Tente novamente.');
      setTimeout(() => setErro(''), 4000);
    } finally { setGerandoPDF(false); }
  }

  async function compartilharRoteiro() {
    setCompartilhando(true);
    try {
      const res = await api.post(`/roteiro/${id}/compartilhar`);
      const baseUrl = `${window.location.protocol}//${window.location.host}`;
      const fullLink = `${baseUrl}/roteiro/publico/${res.data.share_token}`;
      setModalCompartilhar({ link: fullLink, token: res.data.share_token });
    } catch {
      setErro('Erro ao compartilhar roteiro. Tente novamente.');
      setTimeout(() => setErro(''), 4000);
    } finally { setCompartilhando(false); }
  }

  async function desativarCompartilhamento() {
    try {
      await api.patch(`/roteiro/${id}/desativar-compartilhamento`);
      setModalCompartilhar(null);
      setSucesso('Compartilhamento desativado!');
      setTimeout(() => setSucesso(''), 3000);
    } catch {
      setErro('Erro ao desativar compartilhamento.');
      setTimeout(() => setErro(''), 4000);
    }
  }

  function copiarLink() {
    if (!modalCompartilhar) return;
    navigator.clipboard.writeText(modalCompartilhar.link);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2500);
  }

  async function enviarEmail() {
    if (!emailDestino || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDestino)) {
      setErro('Digite um email válido.');
      setTimeout(() => setErro(''), 3000);
      return;
    }
    setEnviandoEmail(true);
    setEmailEnviado(false);
    try {
      await api.post(`/roteiro/${id}/enviar-email`, {
        email_destino: emailDestino,
        mensagem_pessoal: mensagemEmail,
      });
      setEmailEnviado(true);
      setEmailDestino('');
      setMensagemEmail('');
      setTimeout(() => setEmailEnviado(false), 5000);
    } catch (err) {
      const msg = err.response?.data?.mensagem || 'Erro ao enviar email.';
      setErro(msg);
      setTimeout(() => setErro(''), 4000);
    } finally {
      setEnviandoEmail(false);
    }
  }

  function abrirGoogleMaps(nome, endereco, lat, lng) {
    const q = lat && lng ? `${lat},${lng}` : encodeURIComponent(`${nome} ${endereco || ''}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  }

  function getAtividadeImagem(id_atividade) {
    return imagens.atividades?.[String(id_atividade)] || imagens.atividades?.[id_atividade] || null;
  }

  if (carregando) {
    return (
      <div className="rt-page">
        <div className="rt-hero-skeleton"><SkeletonBlock height="400px" radius="0" /></div>
        <div className="container" style={{ marginTop: '2rem' }}>
          <div className="rt-grid-4">
            {[1,2,3,4].map(i => <SkeletonBlock key={i} height="80px" radius="12px" />)}
          </div>
          <SkeletonBlock height="200px" radius="12px" />
          <SkeletonBlock height="300px" radius="12px" />
        </div>
      </div>
    );
  }

  if (!roteiro) return <div className="container"><p>Roteiro não encontrado.</p></div>;

  const totalAtividades = todasAtividades.length;
  const realizadas = todasAtividades.filter(a => a.realizada).length;
  const infoCidade = metadados.info_cidade || {};
  const infoDestino = metadados.info_destino || {};
  const locaisProximos = metadados.locais_proximos || [];
  const temCoordAproximada = pontosFiltrados.some(p => p.coordAproximada);
  const sugestoesExtras = metadados.sugestoes_extras || [];
  const restaurantesExtras = metadados.restaurantes_extras || [];
  const estimativaGastos = metadados.estimativa_gastos || null;

  const custoTotal = dias.reduce((total, d) => total + d.atividades.reduce((acc, a) => acc + (parseFloat(a.custo_estimado) || 0), 0), 0);
  const totalRestaurantes = todasAtividades.filter(a => a.tipo === 'restaurante').length;
  const totalPasseios = todasAtividades.filter(a => a.tipo !== 'restaurante').length;

  const heroImage = imagens.headerImage || null;
  const cidadeDescricao = infoDestino.descricao || infoCidade.historia || '';
  const cidadeNome = infoDestino.nome_completo || roteiro.destino || '';
  const cidadePais = infoDestino.pais || '';
  const cidadeEstado = infoDestino.estado || '';

  let contadorGlobal = 0;

  return (
    <div className="rt-page">
      {/* ════════ HERO BANNER ════════ */}
      <div className="rt-hero" style={heroImage ? { backgroundImage: `url(${heroImage})` } : {}}>
        <div className="rt-hero-overlay">
          <div className="rt-hero-nav">
            <button className="rt-hero-btn" onClick={() => navigate('/dashboard')}><FiHome /> Menu</button>
            <button className="rt-hero-btn" onClick={() => navigate(`/viagens/${roteiro.fk_viagem_id_viagem}`)}><FiArrowLeft /> Voltar</button>
          </div>
          <div className="rt-hero-content">
            <h1 className="rt-hero-title">{roteiro.destino}</h1>
            {(cidadeEstado || cidadePais) && (
              <p className="rt-hero-subtitle">
                {cidadeEstado}{cidadeEstado && cidadePais ? ', ' : ''}{cidadePais}
              </p>
            )}
            {cidadeDescricao && <p className="rt-hero-desc">{cidadeDescricao}</p>}
            <div className="rt-hero-badges">
              <span><FiCalendar /> {roteiro.quantidade_dias} dia(s)</span>
              <span><FiMapPin /> {totalAtividades} atividades</span>
              {roteiro.orcamento && <span><FiDollarSign /> R$ {parseFloat(roteiro.orcamento).toFixed(0)}</span>}
            </div>
          </div>
        </div>
        {!heroImage && (
          <div className="rt-hero-gradient" />
        )}
      </div>

      <div className="container rt-container">
        {/* ════════ ACTION BAR ════════ */}
        <div className="rt-action-bar">
          <button className="btn btn-primary rt-action-btn" onClick={baixarPDF} disabled={gerandoPDF}>
            <FiDownload /> {gerandoPDF ? 'Gerando...' : 'Baixar PDF'}
          </button>
          <button className="btn btn-primary rt-action-btn rt-action-dark" onClick={compartilharRoteiro} disabled={compartilhando}>
            <FiShare2 /> {compartilhando ? 'Compartilhando...' : 'Compartilhar'}
          </button>
        </div>

        {erro && <div className="alert alert-erro">{erro}</div>}
        {sucesso && <div className="alert alert-sucesso">{sucesso}</div>}

        {/* ════════ MODAIS ════════ */}
        {modalCompartilhar && (
          <div className="modal-overlay" onClick={() => setModalCompartilhar(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
              <h3 style={{ marginBottom: '0.8rem' }}><FiShare2 /> Roteiro compartilhado!</h3>
              <p style={{ color: '#636e72', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Qualquer pessoa com o link abaixo pode visualizar este roteiro (somente leitura).
              </p>
              <div style={{ background: '#f5f6fa', borderRadius: 10, padding: '0.8rem 1rem', marginBottom: '1rem', wordBreak: 'break-all', fontSize: '0.85rem', color: '#2d3436', border: '1px solid #dfe6e9' }}>
                {modalCompartilhar.link}
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
                <button className="btn btn-primary" onClick={copiarLink}>
                  <FiCopy /> {linkCopiado ? 'Link copiado!' : 'Copiar link'}
                </button>
                <button className="btn btn-secondary" onClick={() => window.open(modalCompartilhar.link, '_blank')}>
                  <FiExternalLink /> Abrir roteiro público
                </button>
                <button className="btn btn-danger btn-sm" onClick={desativarCompartilhamento} style={{ marginLeft: 'auto' }}>
                  Desativar link
                </button>
              </div>

              <div style={{ borderTop: '1px solid #eee', paddingTop: '1.2rem' }}>
                <h4 style={{ margin: '0 0 0.6rem', fontSize: '1rem', color: '#2d3436', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FiMail /> Enviar por email
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <input
                    type="email"
                    placeholder="Email do destinatário"
                    value={emailDestino}
                    onChange={e => setEmailDestino(e.target.value)}
                    style={{ padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid #dfe6e9', fontSize: '0.9rem', outline: 'none' }}
                  />
                  <textarea
                    placeholder="Mensagem pessoal (opcional)"
                    value={mensagemEmail}
                    onChange={e => setMensagemEmail(e.target.value)}
                    rows={2}
                    style={{ padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid #dfe6e9', fontSize: '0.9rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={enviarEmail}
                    disabled={enviandoEmail || !emailDestino}
                    style={{ background: '#27ae60', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                  >
                    <FiSend />
                    {enviandoEmail ? 'Enviando...' : emailEnviado ? 'Email enviado!' : 'Enviar roteiro por email'}
                  </button>
                  {emailEnviado && (
                    <p style={{ color: '#27ae60', fontSize: '0.85rem', margin: 0, fontWeight: 500 }}>
                      Roteiro enviado com sucesso para {emailDestino || 'o destinatário'}!
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

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

        {/* ════════ INFO DESTINO ════════ */}
        {(infoDestino.melhor_epoca || infoDestino.clima || infoCidade.historia) && (
          <section className="rt-section rt-info-section">
            <div className="rt-section-header" onClick={() => setInfoCidadeAberta(!infoCidadeAberta)}>
              <h2><FiInfo /> Sobre {roteiro.destino}</h2>
              {infoCidadeAberta ? <FiChevronDown size={20} /> : <FiChevronRight size={20} />}
            </div>
            {infoCidadeAberta && (
              <div className="rt-info-grid">
                {infoDestino.melhor_epoca && (
                  <div className="rt-info-card">
                    <FiSun className="rt-info-icon" />
                    <span className="rt-info-label">Melhor época</span>
                    <span className="rt-info-value">{infoDestino.melhor_epoca}</span>
                  </div>
                )}
                {infoDestino.clima && (
                  <div className="rt-info-card">
                    <FiThermometer className="rt-info-icon" />
                    <span className="rt-info-label">Clima</span>
                    <span className="rt-info-value">{infoDestino.clima}</span>
                  </div>
                )}
                {infoDestino.temperatura_media && (
                  <div className="rt-info-card">
                    <FiThermometer className="rt-info-icon" />
                    <span className="rt-info-label">Temperatura média</span>
                    <span className="rt-info-value">{infoDestino.temperatura_media}</span>
                  </div>
                )}
                {infoDestino.populacao && (
                  <div className="rt-info-card">
                    <FiUsers className="rt-info-icon" />
                    <span className="rt-info-label">População</span>
                    <span className="rt-info-value">{infoDestino.populacao}</span>
                  </div>
                )}
                {infoDestino.idioma && (
                  <div className="rt-info-card">
                    <FiGlobe className="rt-info-icon" />
                    <span className="rt-info-label">Idioma</span>
                    <span className="rt-info-value">{infoDestino.idioma}</span>
                  </div>
                )}
                {infoDestino.moeda && (
                  <div className="rt-info-card">
                    <FiDollarSign className="rt-info-icon" />
                    <span className="rt-info-label">Moeda</span>
                    <span className="rt-info-value">{infoDestino.moeda}</span>
                  </div>
                )}
                {infoDestino.fuso_horario && (
                  <div className="rt-info-card">
                    <FiClock className="rt-info-icon" />
                    <span className="rt-info-label">Fuso horário</span>
                    <span className="rt-info-value">{infoDestino.fuso_horario}</span>
                  </div>
                )}
                {infoDestino.aeroporto_principal && (
                  <div className="rt-info-card">
                    <FiNavigation className="rt-info-icon" />
                    <span className="rt-info-label">Aeroporto</span>
                    <span className="rt-info-value">{infoDestino.aeroporto_principal}</span>
                  </div>
                )}

                {/* Fallback: old info_cidade data */}
                {!infoDestino.clima && infoCidade.clima && (
                  <div className="rt-info-card">
                    <FiThermometer className="rt-info-icon" />
                    <span className="rt-info-label">Clima</span>
                    <span className="rt-info-value">{infoCidade.clima}</span>
                  </div>
                )}
                {!infoDestino.populacao && infoCidade.populacao && (
                  <div className="rt-info-card">
                    <FiUsers className="rt-info-icon" />
                    <span className="rt-info-label">População</span>
                    <span className="rt-info-value">{infoCidade.populacao}</span>
                  </div>
                )}
              </div>
            )}
            {infoCidadeAberta && (infoDestino.curiosidades || infoCidade.curiosidades) && (
              <div className="rt-curiosidades">
                <h4>Curiosidades</h4>
                {Array.isArray(infoDestino.curiosidades) ? (
                  <ul>{infoDestino.curiosidades.map((c, i) => <li key={i}>{c}</li>)}</ul>
                ) : (infoCidade.curiosidades && <p>{infoCidade.curiosidades}</p>)}
              </div>
            )}
            {infoCidadeAberta && (infoDestino.dicas_turista || infoCidade.dica_geral) && (
              <div className="rt-dicas">
                <h4>Dicas para turistas</h4>
                {Array.isArray(infoDestino.dicas_turista) ? (
                  <ul>{infoDestino.dicas_turista.map((d, i) => <li key={i}>{d}</li>)}</ul>
                ) : (infoCidade.dica_geral && <p>{infoCidade.dica_geral}</p>)}
              </div>
            )}
          </section>
        )}

        {/* ════════ RESUMO DA VIAGEM ════════ */}
        <section className="rt-section">
          <h2 className="rt-section-title"><FiMap /> Resumo da Viagem</h2>
          <div className="rt-summary-row">
            <div className="rt-summary-card">
              <span className="rt-summary-icon" style={{ color: '#FF6B35' }}><FiCalendar /></span>
              <span className="rt-summary-num">{roteiro.quantidade_dias}</span>
              <span className="rt-summary-label">Dia(s)</span>
            </div>
            <div className="rt-summary-card">
              <span className="rt-summary-icon" style={{ color: '#3498db' }}><FiCamera /></span>
              <span className="rt-summary-num">{totalPasseios}</span>
              <span className="rt-summary-label">Passeios</span>
            </div>
            <div className="rt-summary-card">
              <span className="rt-summary-icon" style={{ color: '#e74c3c' }}><FiCoffee /></span>
              <span className="rt-summary-num">{totalRestaurantes}</span>
              <span className="rt-summary-label">Restaurantes</span>
            </div>
            <div className="rt-summary-card">
              <span className="rt-summary-icon" style={{ color: '#27ae60' }}><FiCheckCircle /></span>
              <span className="rt-summary-num">{realizadas}/{totalAtividades}</span>
              <span className="rt-summary-label">Realizadas</span>
            </div>
            {rotaInfo?.distanciaTotalTexto && (
              <div className="rt-summary-card">
                <span className="rt-summary-icon" style={{ color: '#8e44ad' }}><FiNavigation /></span>
                <span className="rt-summary-num">{rotaInfo.distanciaTotalTexto}</span>
                <span className="rt-summary-label">Distância</span>
              </div>
            )}
            {rotaInfo?.duracaoTotalTexto && (
              <div className="rt-summary-card">
                <span className="rt-summary-icon" style={{ color: '#f39c12' }}><FiClock /></span>
                <span className="rt-summary-num">{rotaInfo.duracaoTotalTexto}</span>
                <span className="rt-summary-label">Deslocamento</span>
              </div>
            )}
            <div className="rt-summary-card rt-summary-highlight">
              <span className="rt-summary-icon" style={{ color: '#fff' }}><FiDollarSign /></span>
              <span className="rt-summary-num">R$ {custoTotal.toFixed(0)}</span>
              <span className="rt-summary-label">Custo estimado</span>
            </div>
          </div>
        </section>

        {/* ════════ ESTIMATIVA DE GASTOS ════════ */}
        {estimativaGastos && (
          <section className="rt-section">
            <h2 className="rt-section-title"><FiDollarSign /> Estimativa de Gastos</h2>
            <div className="rt-gastos-table">
              <div className="rt-gastos-header">
                <span>Categoria</span>
                <span>Mínimo</span>
                <span>Médio</span>
                <span>Confortável</span>
              </div>
              {[
                { key: 'passeios', label: '🎯 Passeios', icon: '🎯' },
                { key: 'alimentacao', label: '🍽️ Alimentação', icon: '🍽️' },
                { key: 'transporte', label: '🚗 Transporte', icon: '🚗' },
                { key: 'hospedagem_diaria', label: '🏨 Hospedagem/dia', icon: '🏨' },
                { key: 'outros', label: '📦 Outros', icon: '📦' },
              ].map(cat => {
                const val = estimativaGastos[cat.key];
                if (!val) return null;
                return (
                  <div key={cat.key} className="rt-gastos-row">
                    <span className="rt-gastos-cat">{cat.label}</span>
                    <span>R$ {val.minimo || 0}</span>
                    <span>R$ {val.medio || 0}</span>
                    <span>R$ {val.confortavel || 0}</span>
                  </div>
                );
              })}
              {estimativaGastos.total_viagem && (
                <div className="rt-gastos-row rt-gastos-total">
                  <span className="rt-gastos-cat">💰 Total da viagem</span>
                  <span>R$ {estimativaGastos.total_viagem.minimo || 0}</span>
                  <span>R$ {estimativaGastos.total_viagem.medio || 0}</span>
                  <span>R$ {estimativaGastos.total_viagem.confortavel || 0}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ════════ PAINEL INFO VIAGEM (edit) ════════ */}
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

        {/* ════════ MAPA ════════ */}
        <section className="rt-section mapa-section">
          <h2 className="rt-section-title"><FiMapPin /> Mapa do Roteiro</h2>

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
              {temCoordAproximada && <small>(posições aproximadas)</small>}
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
            <div className="mapa-fallback"><div className="spinner" /><p>Carregando mapa de {roteiro.destino}...</p></div>
          ) : centroMapa ? (
            <div className="mapa-container-leaflet" key={`map-${centroMapa[0]}-${centroMapa[1]}`}>
              <MapContainer center={centroMapa} zoom={pontosFiltrados.length > 0 ? 13 : 12} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
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
                          {trecho?.distanciaTexto && (
                            <p style={{ margin: '4px 0', fontSize: '0.78rem', color: '#2980b9', background: '#eaf2f8', padding: '3px 6px', borderRadius: '4px' }}>
                              Próximo: {trecho.distanciaTexto}{trecho.duracaoTexto ? ` - ${trecho.duracaoTexto}` : ''}
                            </p>
                          )}
                          {a.descricao && <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#555', lineHeight: '1.4', borderTop: '1px solid #eee', paddingTop: '4px' }}>{a.descricao.substring(0, 150)}{a.descricao.length > 150 ? '...' : ''}</p>}
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
            <div className="mapa-fallback"><FiMapPin size={32} /><p>Não foi possível carregar o mapa.</p></div>
          )}
        </section>

        {/* ════════ ROTEIRO DIA-A-DIA ════════ */}
        <section className="rt-section">
          <div className="rt-dias-header">
            <h2 className="rt-section-title"><FiCalendar /> Roteiro Dia a Dia</h2>
            <div className="accordion-controls">
              <button className="btn btn-sm btn-secondary" onClick={expandirTodos}>Expandir todos</button>
              <button className="btn btn-sm btn-secondary" onClick={recolherTodos}>Recolher todos</button>
            </div>
          </div>

          <div className="dias-grid">
            {dias.map(diaObj => {
              const aberto = diasAbertos[diaObj.dia] || false;
              const realizadasDia = diaObj.atividades.filter(a => a.realizada).length;
              const custoTotalDia = diaObj.atividades.reduce((acc, a) => acc + (parseFloat(a.custo_estimado) || 0), 0);
              const tituloDia = diaObj.titulo || `Dia ${diaObj.dia}`;
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
                          const imgUrl = getAtividadeImagem(ativ.id_atividade);
                          return (
                            <div key={ativ.id_atividade} className={`rt-ativ-card ${ativ.realizada ? 'atividade-realizada' : ''}`}>
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
                                <div className="rt-ativ-inner">
                                  <div className="rt-ativ-img-wrap">
                                    <SmartImage src={imgUrl} alt={ativ.nome_atividade} tipo={ativ.tipo} size="card" className="rt-ativ-img" />
                                    {ativ.tipo && (
                                      <span className="rt-ativ-badge" style={{ background: TIPO_CORES[ativ.tipo] || '#FF6B35' }}>
                                        {TIPO_EMOJI[ativ.tipo]} {TIPO_LABEL[ativ.tipo] || ativ.tipo}
                                      </span>
                                    )}
                                    <span className="rt-ativ-num" style={{ background: TIPO_CORES[ativ.tipo] || '#FF6B35' }}>{numAtiv}</span>
                                  </div>
                                  <div className="rt-ativ-body">
                                    <div className="rt-ativ-top">
                                      <div className="rt-ativ-title-row" onClick={() => toggleDetalheAtividade(ativ.id_atividade)}>
                                        <button className="checkbox-btn" onClick={e => { e.stopPropagation(); toggleRealizada(ativ); }} title={ativ.realizada ? 'Pendente' : 'Realizada'}>
                                          {ativ.realizada ? <FiCheckSquare size={20} className="check-done" /> : <FiSquare size={20} />}
                                        </button>
                                        <h4 className={ativ.realizada ? 'info-riscado' : ''}>{ativ.nome_atividade || 'Atividade'}</h4>
                                        {expandida ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
                                      </div>
                                      <div className="rt-ativ-actions">
                                        <button className="btn-icon" onClick={() => iniciarEdicao(ativ)} title="Editar"><FiEdit /></button>
                                        <button className="btn-icon btn-icon-danger" onClick={() => excluirAtividade(ativ.id_atividade)} title="Excluir"><FiTrash2 /></button>
                                      </div>
                                    </div>
                                    <RatingStars rating={ativ.avaliacao} />
                                    <div className="rt-ativ-meta">
                                      {ativ.horario && <span><FiClock size={13} /> {ativ.horario}</span>}
                                      {ativ.tempo_visita && <span>🕐 {ativ.tempo_visita}</span>}
                                      <span style={{ color: parseFloat(ativ.custo_estimado) > 0 ? '#27ae60' : '#7f8c8d', fontWeight: 600 }}>
                                        {parseFloat(ativ.custo_estimado) > 0 ? `R$ ${parseFloat(ativ.custo_estimado).toFixed(2)}` : 'Gratuito'}
                                      </span>
                                      {ativ.deslocamento_proximo && <span className="deslocamento-badge">🚗 {ativ.deslocamento_proximo}</span>}
                                    </div>
                                    {ativ.local && <p className="rt-ativ-local"><FiMapPin size={13} /> {ativ.local}</p>}
                                    {expandida && ativ.descricao && <p className="rt-ativ-desc">{ativ.descricao}</p>}
                                    {expandida && (
                                      <button className="rt-maps-btn" onClick={() => abrirGoogleMaps(ativ.nome_atividade, ativ.local, ativ.lat, ativ.lng)}>
                                        <FiExternalLink size={13} /> Ver no Google Maps
                                      </button>
                                    )}
                                  </div>
                                </div>
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
        </section>

        {/* ════════ SUGESTÕES EXTRAS ════════ */}
        {sugestoesExtras.length > 0 && (
          <section className="rt-section">
            <h2 className="rt-section-title"><FiCamera /> Outros Lugares para Conhecer</h2>
            <p className="rt-section-subtitle">Sugestões extras que não fazem parte do roteiro principal</p>
            <div className="rt-extras-grid">
              {sugestoesExtras.map((sug, i) => {
                const imgUrl = imagens.sugestoes?.[i] || null;
                return (
                  <div key={i} className="rt-extra-card">
                    <div className="rt-extra-img-wrap">
                      <SmartImage src={imgUrl} alt={sug.nome} tipo={sug.categoria || 'ponto_turistico'} size="medium" className="rt-extra-img" />
                    </div>
                    <div className="rt-extra-body">
                      <h4>{sug.nome}</h4>
                      <RatingStars rating={sug.avaliacao} />
                      <p className="rt-extra-desc">{sug.descricao}</p>
                      <div className="rt-extra-meta">
                        {sug.valor_medio != null && <span><FiDollarSign size={12} /> R$ {sug.valor_medio}</span>}
                        {sug.tempo_visita && <span><FiClock size={12} /> {sug.tempo_visita}</span>}
                        {sug.categoria && <span className="rt-extra-tag">{sug.categoria}</span>}
                      </div>
                      <button className="rt-add-btn" onClick={() => abrirSeletorDia(sug)}>
                        <FiPlus size={14} /> Adicionar ao roteiro
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ════════ RESTAURANTES EXTRAS ════════ */}
        {restaurantesExtras.length > 0 && (
          <section className="rt-section">
            <h2 className="rt-section-title">🍽️ Restaurantes Recomendados</h2>
            <p className="rt-section-subtitle">Opções gastronômicas selecionadas para sua viagem</p>
            <div className="rt-extras-grid">
              {restaurantesExtras.map((rest, i) => {
                const imgUrl = imagens.restaurantes?.[i] || null;
                return (
                  <div key={i} className="rt-extra-card">
                    <div className="rt-extra-img-wrap">
                      <SmartImage src={imgUrl} alt={rest.nome} tipo="restaurante" size="medium" className="rt-extra-img" />
                    </div>
                    <div className="rt-extra-body">
                      <h4>{rest.nome}</h4>
                      <RatingStars rating={rest.avaliacao} />
                      {rest.especialidade && <p className="rt-extra-spec">{rest.especialidade}</p>}
                      <div className="rt-extra-meta">
                        {rest.faixa_preco && <span><FiDollarSign size={12} /> {rest.faixa_preco}</span>}
                        {rest.horario_funcionamento && <span><FiClock size={12} /> {rest.horario_funcionamento}</span>}
                      </div>
                      {rest.endereco && <p className="rt-extra-addr"><FiMapPin size={12} /> {rest.endereco}</p>}
                      <button className="rt-add-btn" onClick={() => abrirSeletorDia({ nome: rest.nome, descricao: rest.especialidade || '', endereco: rest.endereco || '', valor_medio: 0 })}>
                        <FiPlus size={14} /> Adicionar ao roteiro
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ════════ LOCAIS PRÓXIMOS (legado) ════════ */}
        {locaisProximos.length > 0 && (
          <section className="rt-section locais-proximos">
            <h4><FiNavigation /> Locais próximos para explorar</h4>
            <div className="locais-grid">
              {locaisProximos.map((l, i) => (
                <div key={i} className="local-card">
                  <div className="local-info">
                    <strong>{TIPO_EMOJI[l.tipo] || '⭐'} {l.nome}</strong>
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
          </section>
        )}
      </div>

      {/* ════════ ESTILOS DO ROTEIRO ════════ */}
      <style>{`
        .rt-page { min-height: 100vh; background: #f8f9fa; }
        .rt-container { max-width: 1100px; padding-top: 0; }

        /* ─── Skeleton ─── */
        .rt-skeleton {
          background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
          background-size: 200% 100%;
          animation: rt-shimmer 1.5s infinite;
        }
        @keyframes rt-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .rt-hero-skeleton { width: 100%; }

        /* ─── Hero ─── */
        .rt-hero {
          position: relative; width: 100%; min-height: 420px;
          background-size: cover; background-position: center;
          display: flex; align-items: flex-end;
        }
        .rt-hero-gradient {
          position: absolute; inset: 0;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%);
          z-index: 0;
        }
        .rt-hero-overlay {
          position: relative; z-index: 1; width: 100%; padding: 2rem 2.5rem;
          background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.15) 100%);
          min-height: 420px; display: flex; flex-direction: column; justify-content: flex-end;
        }
        .rt-hero-nav {
          position: absolute; top: 1.2rem; left: 1.5rem;
          display: flex; gap: 0.6rem;
        }
        .rt-hero-btn {
          background: rgba(255,255,255,0.15); backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.25); color: #fff;
          padding: 0.5rem 1rem; border-radius: 10px; cursor: pointer;
          font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem;
          transition: background 0.2s;
        }
        .rt-hero-btn:hover { background: rgba(255,255,255,0.25); }
        .rt-hero-content { max-width: 700px; }
        .rt-hero-title {
          font-size: 3rem; font-weight: 800; color: #fff;
          text-shadow: 0 2px 12px rgba(0,0,0,0.5); margin: 0 0 0.3rem;
          line-height: 1.1;
        }
        .rt-hero-subtitle {
          font-size: 1.2rem; color: rgba(255,255,255,0.85); margin: 0 0 0.8rem;
          font-weight: 400;
        }
        .rt-hero-desc {
          font-size: 0.95rem; color: rgba(255,255,255,0.8); line-height: 1.6;
          margin: 0 0 1rem; max-width: 600px;
        }
        .rt-hero-badges {
          display: flex; gap: 0.8rem; flex-wrap: wrap;
        }
        .rt-hero-badges span {
          display: flex; align-items: center; gap: 0.35rem;
          background: rgba(255,255,255,0.15); backdrop-filter: blur(4px);
          padding: 0.4rem 0.9rem; border-radius: 20px;
          color: #fff; font-size: 0.85rem; font-weight: 500;
          border: 1px solid rgba(255,255,255,0.2);
        }

        /* ─── Action Bar ─── */
        .rt-action-bar {
          display: flex; gap: 0.8rem; margin: 1.5rem 0; flex-wrap: wrap;
        }
        .rt-action-btn { border-radius: 10px; font-weight: 600; }
        .rt-action-dark { background: #2d3436; }
        .rt-action-dark:hover { background: #636e72; }

        /* ─── Sections ─── */
        .rt-section {
          background: #fff; border-radius: 16px; padding: 1.8rem;
          margin-bottom: 1.5rem; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          animation: rt-fadein 0.4s ease;
        }
        @keyframes rt-fadein { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .rt-section-title {
          font-size: 1.4rem; font-weight: 700; color: #2d3436;
          display: flex; align-items: center; gap: 0.5rem; margin: 0 0 1.2rem;
        }
        .rt-section-subtitle {
          color: #636e72; font-size: 0.9rem; margin: -0.8rem 0 1.2rem;
        }

        /* ─── Info Section ─── */
        .rt-info-section .rt-section-header {
          display: flex; justify-content: space-between; align-items: center;
          cursor: pointer; margin-bottom: 1rem;
        }
        .rt-info-section .rt-section-header h2 {
          font-size: 1.4rem; font-weight: 700; color: #2d3436;
          display: flex; align-items: center; gap: 0.5rem; margin: 0;
        }
        .rt-info-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 1rem; margin-bottom: 1rem;
        }
        .rt-info-card {
          background: #f8f9fa; border-radius: 12px; padding: 1rem;
          display: flex; flex-direction: column; gap: 0.3rem;
          border: 1px solid #eef1f5; transition: transform 0.2s, box-shadow 0.2s;
        }
        .rt-info-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .rt-info-icon { color: #FF6B35; font-size: 1.3rem; }
        .rt-info-label { font-size: 0.75rem; color: #636e72; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
        .rt-info-value { font-size: 0.9rem; color: #2d3436; font-weight: 500; line-height: 1.4; }

        .rt-curiosidades, .rt-dicas {
          background: #f0faf4; border-radius: 12px; padding: 1rem 1.2rem; margin-top: 1rem;
          border: 1px solid #d4efdf;
        }
        .rt-dicas { background: #eaf2f8; border-color: #bdc3c7; }
        .rt-curiosidades h4, .rt-dicas h4 { margin: 0 0 0.6rem; color: #2d3436; font-size: 1rem; }
        .rt-curiosidades ul, .rt-dicas ul { margin: 0; padding-left: 1.2rem; }
        .rt-curiosidades li, .rt-dicas li { margin-bottom: 0.4rem; font-size: 0.9rem; color: #444; line-height: 1.5; }

        /* ─── Summary ─── */
        .rt-summary-row {
          display: flex; flex-wrap: wrap; gap: 0.8rem; justify-content: center;
        }
        .rt-summary-card {
          background: #f8f9fa; border-radius: 12px; padding: 1rem 1.4rem;
          display: flex; flex-direction: column; align-items: center;
          gap: 0.25rem; border: 1px solid #eef1f5; text-align: center;
          transition: transform 0.2s; flex: 1 1 110px; min-width: 100px; max-width: 160px;
        }
        .rt-summary-card:hover { transform: translateY(-2px); }
        .rt-summary-icon { font-size: 1.4rem; display: flex; align-items: center; justify-content: center; }
        .rt-summary-num { font-size: 1.5rem; font-weight: 800; color: #2d3436; white-space: nowrap; }
        .rt-summary-label { font-size: 0.72rem; color: #636e72; font-weight: 500; text-transform: uppercase; letter-spacing: 0.3px; }
        .rt-summary-highlight { background: linear-gradient(135deg, #27ae60, #2ecc71); }
        .rt-summary-highlight .rt-summary-num { color: #fff; }
        .rt-summary-highlight .rt-summary-label { color: rgba(255,255,255,0.9); }

        /* ─── Gastos ─── */
        .rt-gastos-table { border-radius: 12px; overflow: hidden; border: 1px solid #eef1f5; }
        .rt-gastos-header {
          display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr;
          background: #2d3436; color: #fff; padding: 0.8rem 1rem;
          font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .rt-gastos-row {
          display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr;
          padding: 0.75rem 1rem; border-bottom: 1px solid #f0f0f0;
          font-size: 0.9rem; color: #444; align-items: center;
          transition: background 0.2s;
        }
        .rt-gastos-row:hover { background: #f8f9fa; }
        .rt-gastos-row:last-child { border-bottom: none; }
        .rt-gastos-cat { font-weight: 600; color: #2d3436; }
        .rt-gastos-total {
          background: #f0faf4; font-weight: 700; border-top: 2px solid #27ae60;
        }
        .rt-gastos-total .rt-gastos-cat { color: #27ae60; }

        /* ─── Dias Header ─── */
        .rt-dias-header {
          display: flex; justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: 0.8rem; margin-bottom: 0.5rem;
        }

        /* ─── Atividade Card (novo) ─── */
        .rt-ativ-card {
          background: #fff; border-radius: 14px; overflow: hidden;
          border: 1px solid #eef1f5; margin-bottom: 0.8rem;
          transition: box-shadow 0.3s, transform 0.2s;
        }
        .rt-ativ-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .rt-ativ-inner { display: flex; gap: 0; min-height: 0; }
        .rt-ativ-img-wrap {
          position: relative; width: 180px; min-height: 140px; flex-shrink: 0;
          overflow: hidden; background: #f0f0f0;
        }
        .rt-ativ-img {
          width: 100%; height: 100%; object-fit: cover; display: block;
        }
        .rt-ativ-img-wrap > .rt-img-fallback { width: 100%; height: 100%; }
        .rt-ativ-badge {
          position: absolute; top: 8px; left: 8px;
          color: #fff; font-size: 0.7rem; font-weight: 600;
          padding: 0.2rem 0.6rem; border-radius: 6px;
          backdrop-filter: blur(4px);
        }
        .rt-ativ-num {
          position: absolute; bottom: 8px; left: 8px;
          color: #fff; font-size: 0.75rem; font-weight: 800;
          width: 26px; height: 26px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        .rt-ativ-body { flex: 1; padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 0.4rem; }
        .rt-ativ-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; }
        .rt-ativ-title-row {
          display: flex; align-items: center; gap: 0.5rem; cursor: pointer; flex: 1;
        }
        .rt-ativ-title-row h4 { margin: 0; font-size: 1rem; font-weight: 700; color: #2d3436; }
        .rt-ativ-actions { display: flex; gap: 0.3rem; flex-shrink: 0; }
        .rt-ativ-meta {
          display: flex; flex-wrap: wrap; gap: 0.6rem; font-size: 0.82rem; color: #636e72;
          align-items: center;
        }
        .rt-ativ-meta span { display: flex; align-items: center; gap: 0.25rem; }
        .rt-ativ-local { font-size: 0.82rem; color: #636e72; display: flex; align-items: center; gap: 0.3rem; margin: 0; }
        .rt-ativ-desc { font-size: 0.85rem; color: #555; line-height: 1.5; margin: 0.3rem 0 0; padding-top: 0.3rem; border-top: 1px solid #f0f0f0; }
        .rt-maps-btn {
          display: inline-flex; align-items: center; gap: 0.3rem;
          background: #4285f4; color: #fff; border: none;
          padding: 0.4rem 0.8rem; border-radius: 8px;
          font-size: 0.78rem; font-weight: 600; cursor: pointer;
          margin-top: 0.4rem; width: fit-content;
          transition: background 0.2s;
        }
        .rt-maps-btn:hover { background: #3367d6; }

        /* ─── Rating ─── */
        .rt-rating { display: flex; align-items: center; gap: 0.15rem; }
        .rt-star { color: #ddd; font-size: 0.9rem; }
        .rt-star-full { color: #f1c40f; }
        .rt-star-half { color: #f1c40f; opacity: 0.6; }
        .rt-rating-num { font-size: 0.78rem; color: #636e72; font-weight: 600; margin-left: 0.3rem; }

        /* ─── Image Fallback ─── */
        .rt-img-fallback {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 0.3rem; color: #fff; text-align: center; padding: 1rem;
          width: 100%; height: 100%; min-height: 120px;
        }
        .rt-img-fallback-card { min-height: 140px; }
        .rt-img-fallback-medium { min-height: 180px; }
        .rt-fallback-emoji { font-size: 2rem; }
        .rt-fallback-nome {
          font-size: 0.8rem; font-weight: 600; max-width: 90%;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          opacity: 0.95;
        }
        .rt-fallback-label {
          font-size: 0.65rem; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.3px;
        }

        /* ─── Extras Grid ─── */
        .rt-extras-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 1.2rem;
        }
        .rt-extra-card {
          background: #fff; border-radius: 14px; overflow: hidden;
          border: 1px solid #eef1f5; transition: box-shadow 0.3s, transform 0.2s;
          display: flex; flex-direction: column;
        }
        .rt-extra-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.1); transform: translateY(-3px); }
        .rt-extra-img-wrap {
          position: relative; width: 100%; height: 180px; overflow: hidden; background: #f0f0f0;
        }
        .rt-extra-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .rt-extra-img-wrap > .rt-img-fallback { width: 100%; height: 100%; }
        .rt-extra-body { padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 0.4rem; flex: 1; }
        .rt-extra-body h4 { margin: 0; font-size: 1rem; font-weight: 700; color: #2d3436; }
        .rt-extra-desc { font-size: 0.85rem; color: #636e72; line-height: 1.4; margin: 0; flex: 1; }
        .rt-extra-spec { font-size: 0.85rem; color: #8e44ad; font-weight: 500; margin: 0; }
        .rt-extra-meta {
          display: flex; flex-wrap: wrap; gap: 0.5rem; font-size: 0.8rem; color: #636e72;
          align-items: center;
        }
        .rt-extra-meta span { display: flex; align-items: center; gap: 0.2rem; }
        .rt-extra-tag {
          background: #eef1f5; padding: 0.15rem 0.5rem; border-radius: 6px;
          font-size: 0.75rem; font-weight: 500; color: #555;
        }
        .rt-extra-addr { font-size: 0.8rem; color: #636e72; display: flex; align-items: center; gap: 0.3rem; margin: 0; }
        .rt-add-btn {
          display: flex; align-items: center; justify-content: center; gap: 0.3rem;
          background: #FF6B35; color: #fff; border: none;
          padding: 0.55rem 1rem; border-radius: 10px;
          font-size: 0.82rem; font-weight: 600; cursor: pointer;
          margin-top: 0.6rem; transition: background 0.2s;
        }
        .rt-add-btn:hover { background: #e65100; }

        /* ─── Responsive ─── */
        @media (max-width: 768px) {
          .rt-hero { min-height: 320px; }
          .rt-hero-overlay { min-height: 320px; padding: 1.2rem; }
          .rt-hero-title { font-size: 2rem; }
          .rt-hero-desc { font-size: 0.85rem; }
          .rt-section { padding: 1.2rem; border-radius: 12px; }
          .rt-info-grid { grid-template-columns: repeat(2, 1fr); }
          .rt-summary-row { gap: 0.5rem; }
          .rt-summary-card { flex: 1 1 80px; min-width: 80px; padding: 0.8rem 0.6rem; }
          .rt-summary-num { font-size: 1.2rem; }
          .rt-gastos-header, .rt-gastos-row {
            grid-template-columns: 1.2fr 1fr 1fr 1fr;
            font-size: 0.75rem; padding: 0.5rem 0.6rem;
          }
          .rt-ativ-inner { flex-direction: column; }
          .rt-ativ-img-wrap { width: 100%; height: 160px; }
          .rt-extras-grid { grid-template-columns: 1fr; }
          .rt-container { padding-left: 0.8rem; padding-right: 0.8rem; }
        }
        @media (max-width: 480px) {
          .rt-hero-title { font-size: 1.6rem; }
          .rt-info-grid { grid-template-columns: 1fr; }
          .rt-summary-row { gap: 0.4rem; }
          .rt-summary-card { min-width: 70px; padding: 0.7rem 0.5rem; }
          .rt-summary-num { font-size: 1rem; }
          .rt-gastos-header, .rt-gastos-row { grid-template-columns: 1fr 1fr 1fr 1fr; font-size: 0.7rem; }
        }
      `}</style>
    </div>
  );
}

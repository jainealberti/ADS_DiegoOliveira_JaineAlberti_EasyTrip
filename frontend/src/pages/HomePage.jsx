import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  FiSearch, FiMapPin, FiCpu, FiStar, FiDollarSign,
  FiCalendar, FiEdit3, FiCheckCircle,
  FiArrowRight, FiClock, FiCompass, FiUsers,
  FiMap, FiHeart, FiSun,
  FiLoader, FiAlertCircle, FiMenu, FiX,
  FiChevronLeft, FiChevronRight
} from 'react-icons/fi';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function MapController({ positions, color }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
    setTimeout(() => map.invalidateSize(), 200);
  }, [map, positions, color]);
  return null;
}

function CardCarousel({ children }) {
  const scrollRef = useRef(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  function updateArrows() {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 10);
    setShowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (el) el.addEventListener('scroll', updateArrows, { passive: true });
    return () => el?.removeEventListener('scroll', updateArrows);
  }, [children]);

  function scroll(dir) {
    const el = scrollRef.current;
    if (el) el.scrollBy({ left: dir * 300, behavior: 'smooth' });
  }

  return (
    <div className="lp-carousel-wrap">
      {showLeft && (
        <button className="lp-carousel-arrow lp-carousel-arrow-left" onClick={() => scroll(-1)} aria-label="Anterior">
          <FiChevronLeft size={22} />
        </button>
      )}
      <div className="lp-cards-scroll" ref={scrollRef}>{children}</div>
      {showRight && (
        <button className="lp-carousel-arrow lp-carousel-arrow-right" onClick={() => scroll(1)} aria-label="Próximo">
          <FiChevronRight size={22} />
        </button>
      )}
    </div>
  );
}

const DESTINOS_POPULARES = [
  { nome: 'Rio de Janeiro', pais: 'Brasil', imagem: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=600&h=400&fit=crop&q=80&auto=format', descricao: 'Praias, cultura e paisagens deslumbrantes' },
  { nome: 'Paris', pais: 'França', imagem: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&h=400&fit=crop&q=80&auto=format', descricao: 'A cidade luz e seus encantos' },
  { nome: 'Gramado', pais: 'Brasil', imagem: 'https://images.unsplash.com/photo-1753288378677-ee9423427702?w=600&h=400&fit=crop&q=80&auto=format', descricao: 'Charme europeu na Serra Gaúcha' },
  { nome: 'Roma', pais: 'Itália', imagem: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600&h=400&fit=crop&q=80&auto=format', descricao: 'História milenar e gastronomia única' },
  { nome: 'Nova York', pais: 'EUA', imagem: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&h=400&fit=crop&q=80&auto=format', descricao: 'A cidade que nunca dorme' },
  { nome: 'Foz do Iguaçu', pais: 'Brasil', imagem: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=600&h=400&fit=crop&q=80&auto=format', descricao: 'Cataratas e natureza exuberante' },
  { nome: 'Salvador', pais: 'Brasil', imagem: 'https://images.unsplash.com/photo-1516306580123-e6e52b1b7b5f?w=600&h=400&fit=crop&q=80&auto=format', descricao: 'Axé, história e praias tropicais' },
  { nome: 'Lisboa', pais: 'Portugal', imagem: 'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=600&h=400&fit=crop&q=80&auto=format', descricao: 'Tradição e modernidade à beira do Tejo' },
];

const TAGS_POPULARES = ['Rio de Janeiro', 'Paris', 'Foz do Iguaçu', 'Gramado', 'Roma'];

const ROTEIRO_EXEMPLO = {
  dias: [
    {
      label: 'Dia 1',
      cor: '#FF6B35',
      atividades: [
        { horario: '08:00', local: 'Cristo Redentor', descricao: 'Visita ao monumento no topo do Corcovado com vista panorâmica', custo: 'R$ 80', lat: -22.9519, lng: -43.2105 },
        { horario: '11:00', local: 'Pão de Açúcar', descricao: 'Passeio de bondinho com vista da Baía de Guanabara', custo: 'R$ 120', lat: -22.9486, lng: -43.1566 },
        { horario: '14:00', local: 'Copacabana', descricao: 'Almoço e caminhada pela orla mais famosa do mundo', custo: 'R$ 60', lat: -22.9711, lng: -43.1823 },
        { horario: '19:00', local: 'Jantar em Ipanema', descricao: 'Restaurante à beira-mar com culinária carioca', custo: 'R$ 150', lat: -22.9838, lng: -43.1984 },
      ],
    },
    {
      label: 'Dia 2',
      cor: '#6c5ce7',
      atividades: [
        { horario: '09:00', local: 'Museu do Amanhã', descricao: 'Museu interativo de ciência e tecnologia na Praça Mauá', custo: 'R$ 30', lat: -22.8946, lng: -43.1797 },
        { horario: '11:30', local: 'Boulevard Olímpico', descricao: 'Caminhada pelos murais e área revitalizada do porto', custo: 'Gratuito', lat: -22.8939, lng: -43.1802 },
        { horario: '14:00', local: 'AquaRio', descricao: 'Maior aquário marinho da América do Sul', custo: 'R$ 100', lat: -22.8930, lng: -43.1875 },
        { horario: '20:00', local: 'Lapa', descricao: 'Vida noturna, samba e Arcos da Lapa', custo: 'R$ 50', lat: -22.9133, lng: -43.1809 },
      ],
    },
    {
      label: 'Dia 3',
      cor: '#00b894',
      atividades: [
        { horario: '09:00', local: 'Jardim Botânico', descricao: 'Passeio entre palmeiras imperiais e flora tropical', custo: 'R$ 25', lat: -22.9672, lng: -43.2247 },
        { horario: '11:00', local: 'Parque Lage', descricao: 'Café no palacete com vista para o Corcovado', custo: 'R$ 40', lat: -22.9605, lng: -43.2117 },
        { horario: '14:00', local: 'Praia do Leblon', descricao: 'Tarde relaxante na praia mais sofisticada do Rio', custo: 'Gratuito', lat: -22.9868, lng: -43.2231 },
      ],
    },
  ],
};

function createNumberedIcon(number, color) {
  return L.divIcon({
    html: `<div style="background:${color};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${number}</div>`,
    className: 'lp-custom-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const HERO_SLIDE_IDS = [
  'photo-1469854523086-cc02fe5d8800',
  'photo-1507525428034-b723cf961d3e',
  'photo-1476514525535-07fb3b4ae5f1',
  'photo-1530789253388-582c481c54b0',
  'photo-1502920917128-1aa500764cbd',
  'photo-1500835556837-99ac94a94552',
  'photo-1504150558240-0b4fd8946624',
  'photo-1506929562872-bb421503ef21',
  'photo-1528127269322-539801943592',
  'photo-1501785888041-af3ef285b470',
];

function shuffleArray(arr) {
  const s = [...arr];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}

const HERO_SLIDES = shuffleArray(HERO_SLIDE_IDS)
  .map(id => `https://images.unsplash.com/${id}?w=1600&q=80`);

const FEATURES = [
  { icone: FiCheckCircle, titulo: 'Recomendações reais', texto: 'Baseadas em dados de locais verificados e avaliações reais de viajantes.' },
  { icone: FiClock, titulo: 'Planejamento em minutos', texto: 'Em vez de horas pesquisando, gere um roteiro completo em poucos cliques.' },
  { icone: FiDollarSign, titulo: 'Estimativa de custos', texto: 'Valores aproximados por atividade para controlar seu orçamento.' },
  { icone: FiEdit3, titulo: 'Roteiros editáveis', texto: 'Personalize cada detalhe do roteiro de acordo com suas preferências.' },
  { icone: FiUsers, titulo: 'Experiência personalizada', texto: 'IA que se adapta ao seu perfil, estilo e necessidades de viagem.' },
  { icone: FiCalendar, titulo: 'Organização por dias', texto: 'Atividades organizadas cronologicamente para cada dia da sua viagem.' },
];

function SkeletonCard() {
  return (
    <div className="lp-skeleton-card">
      <div className="lp-skeleton lp-skeleton-img" />
      <div className="lp-skeleton lp-skeleton-title" />
      <div className="lp-skeleton lp-skeleton-text" />
      <div className="lp-skeleton lp-skeleton-text lp-skeleton-short" />
    </div>
  );
}

function StarRating({ rating }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.3;
  return (
    <span className="lp-star-rating">
      {Array.from({ length: 5 }).map((_, i) => (
        <FiStar
          key={i}
          size={14}
          className={i < full ? 'lp-star-filled' : (i === full && hasHalf) ? 'lp-star-half' : ''}
        />
      ))}
      <span className="lp-star-value">{rating.toFixed(1)}</span>
    </span>
  );
}

export default function HomePage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [destino, setDestino] = useState('');
  const [exploracaoResultado, setExploracaoResultado] = useState(null);
  const [exploracaoCarregando, setExploracaoCarregando] = useState(false);
  const [exploracaoErro, setExploracaoErro] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [diaAtivo, setDiaAtivo] = useState(0);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [heroSlide, setHeroSlide] = useState(() => Math.floor(Math.random() * HERO_SLIDES.length));
  const exploracaoRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    function handleScroll() {
      setHeaderScrolled(window.scrollY > 60);
    }
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroSlide(prev => (prev + 1) % HERO_SLIDES.length);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  function scrollToSection(id) {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleExplorarDestino(e) {
    e?.preventDefault();
    if (!destino.trim()) return;

    setExploracaoCarregando(true);
    setExploracaoErro('');
    setExploracaoResultado(null);

    try {
      const res = await api.post('/ia/explorar-destino', { destino: destino.trim() });
      setExploracaoResultado(res.data);
      setTimeout(() => {
        exploracaoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (err) {
      const msg = err.response?.data?.error?.message
        || 'Não foi possível explorar este destino. Tente novamente.';
      setExploracaoErro(msg);
    } finally {
      setExploracaoCarregando(false);
    }
  }

  function handleGerarRoteiro() {
    const params = destino.trim() ? `?destino=${encodeURIComponent(destino.trim())}` : '';
    if (usuario) {
      navigate(`/viagens/nova${params}`);
    } else {
      navigate('/login');
    }
  }

  function handleDestinoPopularClick(nomeDestino) {
    setDestino(nomeDestino);
    setExploracaoResultado(null);
    setExploracaoErro('');
    searchInputRef.current?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleTagClick(tag) {
    setDestino(tag);
    searchInputRef.current?.focus();
  }


  function handleImgError(e) {
    e.target.onerror = null;
    e.target.style.display = 'none';
    if (e.target.parentElement) {
      e.target.parentElement.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
  }

  return (
    <div className="lp-page">
      {/* ===== 1. HEADER ===== */}
      <header className={`lp-header ${headerScrolled ? 'lp-header-scrolled' : ''}`}>
        <div className="lp-header-inner">
          <Link to="/" className="lp-logo">
            <FiCompass size={24} />
            <span>EasyTrip</span>
          </Link>

          <nav className={`lp-nav ${mobileMenuOpen ? 'lp-nav-open' : ''}`}>
            <button className="lp-nav-close" onClick={() => setMobileMenuOpen(false)} aria-label="Fechar menu">
              <FiX size={24} />
            </button>
            <a onClick={() => scrollToSection('destinos')}>Destinos</a>
            <a onClick={() => scrollToSection('hero')}>Explorar</a>
            <a onClick={() => scrollToSection('como-funciona')}>Como funciona</a>
            <a onClick={() => scrollToSection('previa')}>Roteiros</a>
          </nav>

          <div className="lp-header-actions">
            {usuario ? (
              <Link to="/dashboard" className="lp-btn lp-btn-primary">Meu painel</Link>
            ) : (
              <>
                <Link to="/login" className="lp-btn lp-btn-ghost">Entrar</Link>
                <button className="lp-btn lp-btn-primary" onClick={handleGerarRoteiro}>
                  Gerar Roteiro com IA
                </button>
              </>
            )}
            <button className="lp-menu-toggle" onClick={() => setMobileMenuOpen(true)} aria-label="Menu">
              <FiMenu size={24} />
            </button>
          </div>
        </div>
      </header>

      {/* ===== 2. HERO BANNER ===== */}
      <section className="lp-hero" id="hero">
        <div className="lp-hero-bg">
          {HERO_SLIDES.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className={`lp-hero-slide ${i === heroSlide ? 'lp-hero-slide-active' : ''}`}
              onError={handleImgError}
            />
          ))}
          <div className="lp-hero-overlay" />
        </div>

        <div className="lp-hero-content">
          <span className="lp-hero-badge">
            <FiCpu size={14} />
            Powered by AI
          </span>

          <h1>Planeje sua próxima viagem com <span>Inteligência Artificial</span></h1>
          <p className="lp-hero-subtitle">
            Descubra destinos, receba recomendações reais e gere roteiros completos em minutos.
          </p>

          <form className="lp-search-bar" onSubmit={handleExplorarDestino}>
            <div className="lp-search-input-wrap">
              <FiSearch size={20} className="lp-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Para onde você quer viajar?"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="lp-btn lp-btn-primary lp-search-btn"
              disabled={exploracaoCarregando || !destino.trim()}
            >
              {exploracaoCarregando ? <FiLoader className="lp-spin" size={18} /> : <FiSearch size={18} />}
              <span>Explorar Destino</span>
            </button>
          </form>

          <div className="lp-hero-tags">
            {TAGS_POPULARES.map((tag) => (
              <button key={tag} className="lp-tag" onClick={() => handleTagClick(tag)}>
                <FiMapPin size={12} />
                {tag}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 3. EXPLORATION RESULT ===== */}
      {(exploracaoCarregando || exploracaoErro || exploracaoResultado) && (
        <section className="lp-section lp-exploration" ref={exploracaoRef} id="exploracao">
          <div className="lp-container">
            {/* Loading */}
            {exploracaoCarregando && (
              <div className="lp-explore-loading">
                <div className="lp-explore-loading-header">
                  <FiLoader className="lp-spin" size={36} />
                  <h3>Explorando <strong>{destino}</strong>...</h3>
                  <p>A IA está buscando atrações, restaurantes e experiências reais</p>
                </div>
                <div className="lp-skeleton-grid">
                  {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              </div>
            )}

            {/* Error */}
            {exploracaoErro && (
              <div className="lp-explore-error">
                <FiAlertCircle size={40} />
                <h3>Ops, algo deu errado</h3>
                <p>{exploracaoErro}</p>
                <button className="lp-btn lp-btn-primary" onClick={handleExplorarDestino}>
                  Tentar novamente
                </button>
              </div>
            )}

            {/* Success */}
            {exploracaoResultado && !exploracaoCarregando && (
              <div className="lp-explore-result">
                {/* City Header */}
                <div className="lp-city-header" style={!exploracaoResultado.headerImage ? { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' } : {}}>
                  {exploracaoResultado.headerImage && (
                    <img
                      src={exploracaoResultado.headerImage}
                      alt={exploracaoResultado.destino}
                      onError={handleImgError}
                    />
                  )}
                  <div className="lp-city-header-overlay">
                    <h2>{exploracaoResultado.destino}</h2>
                    {exploracaoResultado.pais && <span className="lp-city-country">{exploracaoResultado.pais}</span>}
                    <p>{exploracaoResultado.resumo}</p>
                  </div>
                </div>

                {/* Info Cards */}
                <div className="lp-info-cards">
                  {exploracaoResultado.melhorEpoca && (
                    <div className="lp-info-card">
                      <FiCalendar size={22} />
                      <strong>Melhor Época</strong>
                      <span>{exploracaoResultado.melhorEpoca}</span>
                    </div>
                  )}
                  {exploracaoResultado.clima && (
                    <div className="lp-info-card">
                      <FiSun size={22} />
                      <strong>Clima</strong>
                      <span>{exploracaoResultado.clima}</span>
                    </div>
                  )}
                  {exploracaoResultado.diasRecomendados && (
                    <div className="lp-info-card">
                      <FiClock size={22} />
                      <strong>Dias Recomendados</strong>
                      <span>{exploracaoResultado.diasRecomendados}</span>
                    </div>
                  )}
                </div>

                {/* Locais para Visitar */}
                {exploracaoResultado.locaisParaVisitar?.length > 0 && (
                  <div className="lp-explore-section">
                    <h3><FiMapPin size={20} /> Locais para Visitar</h3>
                    <CardCarousel>
                      {exploracaoResultado.locaisParaVisitar.map((item, i) => (
                        <div key={i} className="lp-place-card">
                          <div className="lp-place-card-img">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.nome} onError={handleImgError} />
                            ) : (
                              <div className="lp-img-placeholder"><FiMapPin size={24} /><span>{item.nome}</span></div>
                            )}
                            {item.categoria && <span className="lp-badge lp-badge-category">{item.categoria}</span>}
                          </div>
                          <div className="lp-place-card-body">
                            <h4>{item.nome}</h4>
                            <p>{item.descricao}</p>
                            {item.avaliacao > 0 && <StarRating rating={item.avaliacao} />}
                          </div>
                        </div>
                      ))}
                    </CardCarousel>
                  </div>
                )}

                {/* Onde Jantar */}
                {exploracaoResultado.ondeJantar?.length > 0 && (
                  <div className="lp-explore-section">
                    <h3><FiStar size={20} /> Onde Jantar</h3>
                    <CardCarousel>
                      {exploracaoResultado.ondeJantar.map((item, i) => (
                        <div key={i} className="lp-place-card">
                          <div className="lp-place-card-img">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.nome} onError={handleImgError} />
                            ) : (
                              <div className="lp-img-placeholder lp-img-placeholder-food"><FiStar size={24} /><span>{item.nome}</span></div>
                            )}
                            {item.faixaPreco && <span className="lp-badge lp-badge-price">{item.faixaPreco}</span>}
                          </div>
                          <div className="lp-place-card-body">
                            <h4>{item.nome}</h4>
                            <p>{item.descricao}</p>
                            {item.tipoCozinha && <span className="lp-cuisine-tag">{item.tipoCozinha}</span>}
                          </div>
                        </div>
                      ))}
                    </CardCarousel>
                  </div>
                )}

                {/* Experiências */}
                {exploracaoResultado.experiencias?.length > 0 && (
                  <div className="lp-explore-section">
                    <h3><FiHeart size={20} /> Experiências</h3>
                    <CardCarousel>
                      {exploracaoResultado.experiencias.map((item, i) => (
                        <div key={i} className="lp-place-card">
                          <div className="lp-place-card-img">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.nome} onError={handleImgError} />
                            ) : (
                              <div className="lp-img-placeholder lp-img-placeholder-exp"><FiHeart size={24} /><span>{item.nome}</span></div>
                            )}
                            {item.tipo && <span className="lp-badge lp-badge-type">{item.tipo}</span>}
                          </div>
                          <div className="lp-place-card-body">
                            <h4>{item.nome}</h4>
                            <p>{item.descricao}</p>
                          </div>
                        </div>
                      ))}
                    </CardCarousel>
                  </div>
                )}

                {/* Dicas */}
                {exploracaoResultado.dicas?.length > 0 && (
                  <div className="lp-explore-section lp-tips-section">
                    <h3><FiCheckCircle size={20} /> Dicas de Viagem</h3>
                    <ul className="lp-tips-list">
                      {exploracaoResultado.dicas.map((dica, i) => (
                        <li key={i}>
                          <FiCheckCircle size={16} />
                          <span>{dica}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Aviso Confiabilidade */}
                {exploracaoResultado.avisoConfiabilidade && (
                  <div className="lp-reliability-notice">
                    <FiAlertCircle size={16} />
                    <span>{exploracaoResultado.avisoConfiabilidade}</span>
                  </div>
                )}

                {/* CTA */}
                <div className="lp-explore-cta">
                  <h3>Gostou? Gere seu roteiro completo</h3>
                  <p>Transforme essa exploração em um itinerário dia a dia, personalizado para você.</p>
                  <button className="lp-btn lp-btn-primary lp-btn-lg" onClick={handleGerarRoteiro}>
                    <FiMap size={20} />
                    Gerar meu roteiro completo
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ===== 4. POPULAR DESTINATIONS ===== */}
      <section className="lp-section" id="destinos">
        <div className="lp-container">
          <h2 className="lp-section-title">Destinos populares</h2>
          <p className="lp-section-subtitle">Escolha um destino e descubra com IA</p>

          <div className="lp-destinations-grid">
            {DESTINOS_POPULARES.map((d, i) => (
              <div
                key={i}
                className="lp-destination-card"
                onClick={() => handleDestinoPopularClick(d.nome)}
              >
                <img
                  src={d.imagem}
                  alt={d.nome}
                  onError={handleImgError}
                />
                <div className="lp-destination-overlay">
                  <h3>{d.nome}</h3>
                  <span className="lp-destination-country">{d.pais}</span>
                  <p>{d.descricao}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 5. ITINERARY PREVIEW + MAP ===== */}
      <section className="lp-section lp-section-alt" id="previa">
        <div className="lp-container">
          <h2 className="lp-section-title">Veja como seu roteiro fica</h2>
          <p className="lp-section-subtitle">Exemplo: 3 dias no Rio de Janeiro</p>

          <div className="lp-itinerary-layout">
            <div className="lp-itinerary-preview">
              <div className="lp-day-tabs">
                {ROTEIRO_EXEMPLO.dias.map((dia, i) => (
                  <button
                    key={i}
                    className={`lp-day-tab ${diaAtivo === i ? 'lp-day-tab-active' : ''}`}
                    onClick={() => setDiaAtivo(i)}
                    style={diaAtivo === i ? { background: dia.cor, borderColor: dia.cor } : {}}
                  >
                    {dia.label}
                  </button>
                ))}
              </div>

              <div className="lp-timeline">
                {ROTEIRO_EXEMPLO.dias[diaAtivo].atividades.map((a, i) => (
                  <div key={i} className="lp-timeline-item">
                    <div className="lp-timeline-marker">
                      <div className="lp-timeline-dot" style={{ background: ROTEIRO_EXEMPLO.dias[diaAtivo].cor }} />
                      {i < ROTEIRO_EXEMPLO.dias[diaAtivo].atividades.length - 1 && (
                        <div className="lp-timeline-line" style={{ background: ROTEIRO_EXEMPLO.dias[diaAtivo].cor + '33' }} />
                      )}
                    </div>
                    <div className="lp-timeline-content">
                      <span className="lp-timeline-time" style={{ color: ROTEIRO_EXEMPLO.dias[diaAtivo].cor }}>
                        <FiClock size={13} /> {a.horario}
                      </span>
                      <h4>{a.local}</h4>
                      <p>{a.descricao}</p>
                      <span className="lp-timeline-cost">
                        <FiDollarSign size={13} /> {a.custo}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lp-itinerary-map">
              <MapContainer
                center={[-22.94, -43.19]}
                zoom={12}
                scrollWheelZoom={false}
                zoomControl={true}
                style={{ width: '100%', height: '100%', minHeight: '460px', borderRadius: '16px' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapController
                  positions={ROTEIRO_EXEMPLO.dias[diaAtivo].atividades.map(a => [a.lat, a.lng])}
                  color={ROTEIRO_EXEMPLO.dias[diaAtivo].cor}
                />
                {ROTEIRO_EXEMPLO.dias[diaAtivo].atividades.map((a, i) => (
                  <Marker
                    key={`${diaAtivo}-${i}`}
                    position={[a.lat, a.lng]}
                    icon={createNumberedIcon(i + 1, ROTEIRO_EXEMPLO.dias[diaAtivo].cor)}
                  >
                    <Popup>
                      <strong>{a.local}</strong><br />
                      <span style={{ fontSize: '0.85em', color: '#64748b' }}>{a.horario} - {a.custo}</span>
                    </Popup>
                  </Marker>
                ))}
                <Polyline
                  positions={ROTEIRO_EXEMPLO.dias[diaAtivo].atividades.map(a => [a.lat, a.lng])}
                  color={ROTEIRO_EXEMPLO.dias[diaAtivo].cor}
                  weight={3}
                  dashArray="8 8"
                  opacity={0.7}
                />
              </MapContainer>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 6. HOW IT WORKS ===== */}
      <section className="lp-section" id="como-funciona">
        <div className="lp-container">
          <h2 className="lp-section-title">Como o EasyTrip organiza sua viagem</h2>

          <div className="lp-steps-grid">
            {[
              { icon: FiSearch, title: 'Escolha um destino', text: 'Digite o nome da cidade ou país e comece a explorar com inteligência artificial.' },
              { icon: FiCpu, title: 'Converse com a IA', text: 'Receba um resumo real com atrações, restaurantes, clima e melhor época.' },
              { icon: FiHeart, title: 'Personalize preferências', text: 'Informe datas, orçamento, estilo de viagem e o que mais importa para você.' },
              { icon: FiMap, title: 'Gere seu roteiro', text: 'A IA monta um roteiro personalizado dia a dia com custos estimados.' },
            ].map((step, i) => (
              <div key={i} className="lp-step-card">
                <div className="lp-step-number">{i + 1}</div>
                <div className="lp-step-icon">
                  <step.icon size={28} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 7. FEATURES / TRUST ===== */}
      <section className="lp-section lp-section-alt" id="features">
        <div className="lp-container">
          <h2 className="lp-section-title">Por que escolher o EasyTrip?</h2>

          <div className="lp-features-grid">
            {FEATURES.map((f, i) => (
              <div key={i} className="lp-feature-card">
                <div className="lp-feature-icon">
                  <f.icone size={24} />
                </div>
                <h3>{f.titulo}</h3>
                <p>{f.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 8. FINAL CTA ===== */}
      <section className="lp-cta-section">
        <div className="lp-container">
          <h2>Pronto para criar sua próxima viagem?</h2>
          <p>Informe seu destino e deixe a IA criar um roteiro perfeito para você.</p>
          <button className="lp-btn lp-btn-primary lp-btn-lg" onClick={handleGerarRoteiro}>
            <FiArrowRight size={20} />
            Gerar meu roteiro agora
          </button>
          <span className="lp-cta-note">Grátis. Sem compromisso.</span>
        </div>
      </section>

      {/* ===== 9. FOOTER ===== */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <div className="lp-footer-brand">
            <FiCompass size={20} />
            <span>EasyTrip</span>
          </div>
          <p>Planejamento inteligente de viagens com IA</p>
          <span className="lp-footer-country">Feito no Brasil</span>
        </div>
      </footer>

      {/* ===== STYLES ===== */}
      <style>{`
        /* === RESET & BASE === */
        .lp-page {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #1a1a2e;
          line-height: 1.6;
          overflow-x: hidden;
        }
        .lp-page *, .lp-page *::before, .lp-page *::after { box-sizing: border-box; }
        .lp-container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
        .lp-section { padding: 80px 0; }
        .lp-section-alt { background: #f8f9fc; }
        .lp-section-title {
          font-size: 2rem;
          font-weight: 700;
          text-align: center;
          margin-bottom: 8px;
          color: #1a1a2e;
        }
        .lp-section-subtitle {
          text-align: center;
          color: #64748b;
          font-size: 1.1rem;
          margin-bottom: 48px;
        }

        /* === BUTTONS === */
        .lp-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          white-space: nowrap;
        }
        .lp-btn-primary {
          background: #FF6B35;
          color: #fff;
        }
        .lp-btn-primary:hover { background: #e55a2b; transform: translateY(-1px); }
        .lp-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .lp-btn-ghost {
          background: transparent;
          color: #1a1a2e;
          border: 1.5px solid #e2e8f0;
        }
        .lp-btn-ghost:hover { border-color: #FF6B35; color: #FF6B35; }
        .lp-btn-lg { padding: 14px 32px; font-size: 1rem; border-radius: 10px; }

        /* === HEADER === */
        .lp-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          padding: 16px 0;
          transition: all 0.3s ease;
          background: transparent;
        }
        .lp-header-scrolled {
          background: rgba(255,255,255,0.97);
          box-shadow: 0 2px 20px rgba(0,0,0,0.08);
          padding: 10px 0;
        }
        .lp-header-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .lp-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          font-size: 1.3rem;
          font-weight: 700;
          color: #FF6B35;
        }
        .lp-header:not(.lp-header-scrolled) .lp-logo { color: #fff; }
        .lp-nav {
          display: flex;
          gap: 32px;
        }
        .lp-nav a {
          font-size: 0.9rem;
          font-weight: 500;
          color: #475569;
          cursor: pointer;
          transition: color 0.2s;
          text-decoration: none;
        }
        .lp-nav a:hover { color: #FF6B35; }
        .lp-header:not(.lp-header-scrolled) .lp-nav a { color: rgba(255,255,255,0.85); }
        .lp-header:not(.lp-header-scrolled) .lp-nav a:hover { color: #fff; }
        .lp-header:not(.lp-header-scrolled) .lp-btn-ghost { color: #fff; border-color: rgba(255,255,255,0.4); }
        .lp-header:not(.lp-header-scrolled) .lp-btn-ghost:hover { border-color: #fff; }
        .lp-nav-close { display: none; }
        .lp-header-actions { display: flex; align-items: center; gap: 12px; }
        .lp-menu-toggle { display: none; background: none; border: none; cursor: pointer; color: inherit; }
        .lp-header:not(.lp-header-scrolled) .lp-menu-toggle { color: #fff; }

        /* === HERO === */
        .lp-hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 120px 24px 80px;
        }
        .lp-hero-bg {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }
        .lp-hero-slide {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0;
          transition: opacity 1.5s ease-in-out;
        }
        .lp-hero-slide-active {
          opacity: 1;
        }
        .lp-hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.4) 100%);
        }
        .lp-hero-content {
          position: relative;
          z-index: 2;
          text-align: center;
          max-width: 780px;
          margin: 0 auto;
        }
        .lp-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,107,53,0.15);
          border: 1px solid rgba(255,107,53,0.3);
          color: #FF6B35;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
          margin-bottom: 24px;
          backdrop-filter: blur(10px);
        }
        .lp-hero-content h1 {
          font-size: 3rem;
          font-weight: 800;
          color: #fff;
          line-height: 1.15;
          margin-bottom: 16px;
        }
        .lp-hero-content h1 span { color: #FF6B35; }
        .lp-hero-subtitle {
          font-size: 1.15rem;
          color: rgba(255,255,255,0.85);
          margin-bottom: 36px;
          line-height: 1.6;
        }

        /* === SEARCH BAR === */
        .lp-search-bar {
          display: flex;
          align-items: center;
          background: #fff;
          border-radius: 14px;
          padding: 6px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.25);
          max-width: 640px;
          margin: 0 auto 24px;
        }
        .lp-search-input-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          padding: 0 16px;
        }
        .lp-search-icon { color: #94a3b8; flex-shrink: 0; }
        .lp-search-input-wrap input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 1rem;
          padding: 12px;
          color: #1a1a2e;
          background: transparent;
        }
        .lp-search-input-wrap input::placeholder { color: #94a3b8; }
        .lp-search-btn { border-radius: 10px; padding: 12px 24px; }
        .lp-search-btn span { display: inline; }

        /* === TAGS === */
        .lp-hero-tags {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
        }
        .lp-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.25);
          color: rgba(255,255,255,0.9);
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s;
          backdrop-filter: blur(4px);
        }
        .lp-tag:hover { background: rgba(255,107,53,0.3); border-color: #FF6B35; color: #fff; }

        /* === EXPLORATION === */
        .lp-exploration { padding-top: 60px; }
        .lp-explore-loading { text-align: center; padding: 40px 0; }
        .lp-explore-loading-header { margin-bottom: 40px; }
        .lp-explore-loading-header h3 { font-size: 1.4rem; margin-top: 16px; }
        .lp-explore-loading-header p { color: #64748b; }
        .lp-skeleton-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        .lp-skeleton-card {
          background: #fff;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }
        .lp-skeleton {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: lp-shimmer 1.5s infinite;
          border-radius: 8px;
        }
        .lp-skeleton-img { height: 140px; margin-bottom: 12px; }
        .lp-skeleton-title { height: 20px; width: 70%; margin-bottom: 8px; }
        .lp-skeleton-text { height: 14px; width: 100%; margin-bottom: 6px; }
        .lp-skeleton-short { width: 50%; }
        @keyframes lp-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

        .lp-explore-error {
          text-align: center;
          padding: 60px 20px;
          color: #ef4444;
        }
        .lp-explore-error h3 { color: #1a1a2e; margin: 16px 0 8px; font-size: 1.3rem; }
        .lp-explore-error p { color: #64748b; margin-bottom: 20px; }

        /* City Header */
        .lp-city-header {
          position: relative;
          border-radius: 16px;
          overflow: hidden;
          height: 300px;
          margin-bottom: 32px;
        }
        .lp-city-header img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .lp-city-header-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 32px;
          color: #fff;
        }
        .lp-city-header-overlay h2 { font-size: 2.2rem; font-weight: 700; margin-bottom: 4px; }
        .lp-city-country {
          font-size: 0.95rem;
          color: rgba(255,255,255,0.8);
          margin-bottom: 8px;
        }
        .lp-city-header-overlay p {
          font-size: 0.95rem;
          color: rgba(255,255,255,0.85);
          max-width: 600px;
          line-height: 1.5;
        }

        /* Info Cards */
        .lp-info-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 40px;
        }
        .lp-info-card {
          background: #fff;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .lp-info-card svg { color: #FF6B35; }
        .lp-info-card strong { font-size: 0.85rem; color: #1a1a2e; }
        .lp-info-card span { font-size: 0.85rem; color: #64748b; }

        /* Explore Sections */
        .lp-explore-section { margin-bottom: 36px; }
        .lp-explore-section h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 1.2rem;
          font-weight: 600;
          margin-bottom: 16px;
          color: #1a1a2e;
        }
        .lp-explore-section h3 svg { color: #FF6B35; }

        /* Cards Carousel */
        .lp-carousel-wrap {
          position: relative;
        }
        .lp-cards-scroll {
          display: flex;
          gap: 16px;
          overflow-x: auto;
          padding: 4px 0 12px;
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .lp-cards-scroll::-webkit-scrollbar { display: none; }
        .lp-carousel-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 5;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: #fff;
          color: #1a1a2e;
          box-shadow: 0 2px 12px rgba(0,0,0,0.15);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .lp-carousel-arrow:hover {
          background: #FF6B35;
          color: #fff;
          box-shadow: 0 4px 16px rgba(255,107,53,0.35);
        }
        .lp-carousel-arrow-left { left: -16px; }
        .lp-carousel-arrow-right { right: -16px; }

        /* Place Card */
        .lp-place-card {
          min-width: 260px;
          max-width: 280px;
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          scroll-snap-align: start;
          transition: transform 0.2s, box-shadow 0.2s;
          flex-shrink: 0;
        }
        .lp-place-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
        .lp-place-card-img {
          position: relative;
          height: 160px;
          overflow: hidden;
          background: linear-gradient(135deg, #e2e8f0 0%, #f1f5f9 100%);
          background: linear-gradient(135deg, #FF6B35, #ff8f65);
        }
        .lp-place-card-img img { width: 100%; height: 100%; object-fit: cover; }
        .lp-img-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #fff;
          padding: 16px;
          text-align: center;
        }
        .lp-img-placeholder span {
          font-size: 0.75rem;
          font-weight: 500;
          opacity: 0.9;
          max-width: 90%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .lp-img-placeholder-food {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        .lp-img-placeholder-exp {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }
        .lp-badge {
          position: absolute;
          top: 10px;
          left: 10px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        .lp-badge-category { background: rgba(255,107,53,0.9); color: #fff; }
        .lp-badge-price { background: rgba(0,184,148,0.9); color: #fff; }
        .lp-badge-type { background: rgba(108,92,231,0.9); color: #fff; }
        .lp-place-card-body { padding: 14px 16px; }
        .lp-place-card-body h4 { font-size: 0.95rem; font-weight: 600; margin-bottom: 6px; }
        .lp-place-card-body p { font-size: 0.83rem; color: #64748b; line-height: 1.4; margin-bottom: 8px; }
        .lp-cuisine-tag {
          display: inline-block;
          font-size: 0.72rem;
          color: #6c5ce7;
          background: rgba(108,92,231,0.1);
          padding: 3px 8px;
          border-radius: 4px;
          font-weight: 500;
        }

        /* Star Rating */
        .lp-star-rating { display: flex; align-items: center; gap: 3px; }
        .lp-star-rating svg { color: #e2e8f0; }
        .lp-star-rating .lp-star-filled { color: #f59e0b; fill: #f59e0b; }
        .lp-star-rating .lp-star-half { color: #f59e0b; }
        .lp-star-value { font-size: 0.78rem; color: #64748b; margin-left: 4px; font-weight: 500; }

        /* Tips */
        .lp-tips-section { background: #f8f9fc; border-radius: 12px; padding: 24px; }
        .lp-tips-list { list-style: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .lp-tips-list li {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 0.88rem;
          color: #475569;
        }
        .lp-tips-list li svg { color: #00b894; flex-shrink: 0; margin-top: 3px; }

        /* Reliability notice */
        .lp-reliability-notice {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: #fef3c7;
          border-radius: 8px;
          font-size: 0.83rem;
          color: #92400e;
          margin: 20px 0;
        }

        /* Explore CTA */
        .lp-explore-cta {
          text-align: center;
          padding: 40px 20px;
          background: linear-gradient(135deg, #1a1a2e 0%, #2d2b55 100%);
          border-radius: 16px;
          margin-top: 32px;
        }
        .lp-explore-cta h3 { color: #fff; font-size: 1.4rem; margin-bottom: 8px; }
        .lp-explore-cta p { color: rgba(255,255,255,0.7); margin-bottom: 20px; }

        /* === DESTINATIONS GRID === */
        .lp-destinations-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }
        .lp-destination-card {
          position: relative;
          border-radius: 14px;
          overflow: hidden;
          height: 280px;
          cursor: pointer;
          transition: transform 0.3s, box-shadow 0.3s;
          border: 2px solid transparent;
        }
        .lp-destination-card:hover {
          transform: scale(1.03);
          box-shadow: 0 12px 36px rgba(0,0,0,0.15);
          border-color: #FF6B35;
        }
        .lp-destination-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s;
        }
        .lp-destination-card:hover img { transform: scale(1.08); }
        .lp-destination-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 20px;
          color: #fff;
        }
        .lp-destination-overlay h3 { font-size: 1.15rem; font-weight: 700; margin-bottom: 2px; }
        .lp-destination-country { font-size: 0.8rem; color: rgba(255,255,255,0.75); margin-bottom: 4px; }
        .lp-destination-overlay p { font-size: 0.8rem; color: rgba(255,255,255,0.8); line-height: 1.3; }

        /* === ITINERARY PREVIEW + MAP === */
        .lp-itinerary-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          align-items: stretch;
        }
        .lp-itinerary-preview {
          background: #fff;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08);
        }
        .lp-itinerary-map {
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08);
          min-height: 460px;
          position: relative;
        }
        .lp-itinerary-map .leaflet-container {
          border-radius: 16px;
          width: 100% !important;
          height: 100% !important;
          min-height: 460px;
          z-index: 1;
        }
        .lp-custom-marker { background: transparent !important; border: none !important; }
        .lp-day-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 28px;
        }
        .lp-day-tab {
          padding: 8px 20px;
          border-radius: 8px;
          font-size: 0.88rem;
          font-weight: 600;
          border: 1.5px solid #e2e8f0;
          background: transparent;
          cursor: pointer;
          color: #475569;
          transition: all 0.2s;
        }
        .lp-day-tab:hover { border-color: #FF6B35; color: #FF6B35; }
        .lp-day-tab-active {
          background: #FF6B35;
          color: #fff;
          border-color: #FF6B35;
        }
        .lp-timeline { display: flex; flex-direction: column; gap: 0; }
        .lp-timeline-item { display: flex; gap: 16px; }
        .lp-timeline-marker {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex-shrink: 0;
          width: 20px;
        }
        .lp-timeline-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #FF6B35;
          border: 2px solid #fff;
          box-shadow: 0 0 0 2px #FF6B35;
          flex-shrink: 0;
        }
        .lp-timeline-line {
          width: 2px;
          flex: 1;
          background: #e2e8f0;
          min-height: 40px;
        }
        .lp-timeline-content {
          padding-bottom: 24px;
          flex: 1;
        }
        .lp-timeline-time {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.78rem;
          color: #64748b;
          margin-bottom: 4px;
          font-weight: 500;
        }
        .lp-timeline-content h4 { font-size: 1rem; font-weight: 600; color: #1a1a2e; margin-bottom: 4px; }
        .lp-timeline-content p { font-size: 0.85rem; color: #64748b; margin-bottom: 6px; }
        .lp-timeline-cost {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 0.78rem;
          color: #00b894;
          font-weight: 600;
        }

        /* === STEPS === */
        .lp-steps-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }
        .lp-step-card {
          text-align: center;
          padding: 28px 20px;
          background: #fff;
          border-radius: 14px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
          position: relative;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .lp-step-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
        .lp-step-number {
          position: absolute;
          top: -14px;
          left: 50%;
          transform: translateX(-50%);
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #FF6B35;
          color: #fff;
          font-size: 0.8rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .lp-step-icon {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          background: rgba(255,107,53,0.1);
          color: #FF6B35;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 8px auto 16px;
        }
        .lp-step-card h3 { font-size: 1rem; font-weight: 600; margin-bottom: 8px; }
        .lp-step-card p { font-size: 0.85rem; color: #64748b; line-height: 1.5; }

        /* === FEATURES === */
        .lp-features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        .lp-feature-card {
          background: #fff;
          border-radius: 14px;
          padding: 28px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .lp-feature-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
        .lp-feature-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(255,107,53,0.1);
          color: #FF6B35;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }
        .lp-feature-card h3 { font-size: 1rem; font-weight: 600; margin-bottom: 8px; }
        .lp-feature-card p { font-size: 0.85rem; color: #64748b; line-height: 1.5; }

        /* === CTA SECTION === */
        .lp-cta-section {
          padding: 80px 24px;
          background: linear-gradient(135deg, #1a1a2e 0%, #2d2b55 100%);
          text-align: center;
        }
        .lp-cta-section h2 { color: #fff; font-size: 2rem; font-weight: 700; margin-bottom: 12px; }
        .lp-cta-section p { color: rgba(255,255,255,0.75); font-size: 1.05rem; margin-bottom: 28px; }
        .lp-cta-note {
          display: block;
          margin-top: 12px;
          font-size: 0.8rem;
          color: rgba(255,255,255,0.5);
        }

        /* === FOOTER === */
        .lp-footer {
          background: #1a1a2e;
          padding: 40px 24px;
          text-align: center;
        }
        .lp-footer-inner { display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .lp-footer-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #FF6B35;
          font-size: 1.1rem;
          font-weight: 700;
        }
        .lp-footer p { color: rgba(255,255,255,0.6); font-size: 0.85rem; }
        .lp-footer-country { color: rgba(255,255,255,0.4); font-size: 0.78rem; }

        /* === SPINNER === */
        .lp-spin { animation: lp-rotate 1s linear infinite; }
        @keyframes lp-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* === RESPONSIVE === */
        @media (max-width: 1024px) {
          .lp-destinations-grid { grid-template-columns: repeat(2, 1fr); }
          .lp-steps-grid { grid-template-columns: repeat(2, 1fr); }
          .lp-features-grid { grid-template-columns: repeat(2, 1fr); }
          .lp-info-cards { grid-template-columns: repeat(3, 1fr); }
          .lp-skeleton-grid { grid-template-columns: repeat(2, 1fr); }
          .lp-itinerary-layout { grid-template-columns: 1fr; }
          .lp-itinerary-map { min-height: 350px; }
        }

        @media (max-width: 768px) {
          .lp-nav {
            position: fixed;
            inset: 0;
            background: #fff;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 24px;
            z-index: 9999;
            transform: translateX(100%);
            transition: transform 0.3s ease;
          }
          .lp-nav-open { transform: translateX(0); }
          .lp-nav a { font-size: 1.1rem; color: #1a1a2e; }
          .lp-nav-close {
            display: block;
            position: absolute;
            top: 20px;
            right: 20px;
            background: none;
            border: none;
            cursor: pointer;
            color: #1a1a2e;
          }
          .lp-menu-toggle { display: block; }
          .lp-header-actions .lp-btn-ghost,
          .lp-header-actions .lp-btn-primary { display: none; }

          .lp-hero-content h1 { font-size: 2rem; }
          .lp-hero-subtitle { font-size: 1rem; }
          .lp-search-bar { flex-direction: column; padding: 12px; }
          .lp-search-btn { width: 100%; justify-content: center; }

          .lp-destinations-grid { grid-template-columns: 1fr; }
          .lp-destination-card { height: 220px; }
          .lp-steps-grid { grid-template-columns: 1fr; }
          .lp-features-grid { grid-template-columns: 1fr; }
          .lp-info-cards { grid-template-columns: 1fr; }
          .lp-skeleton-grid { grid-template-columns: 1fr; }
          .lp-tips-list { grid-template-columns: 1fr; }
          .lp-city-header { height: 220px; }
          .lp-city-header-overlay h2 { font-size: 1.6rem; }
          .lp-itinerary-layout { grid-template-columns: 1fr; }
          .lp-itinerary-preview { padding: 20px; }
          .lp-itinerary-map { min-height: 300px; }
          .lp-section-title { font-size: 1.6rem; }
          .lp-cta-section h2 { font-size: 1.5rem; }
        }

        @media (max-width: 480px) {
          .lp-hero { min-height: 90vh; padding-top: 100px; }
          .lp-hero-content h1 { font-size: 1.7rem; }
          .lp-day-tabs { flex-wrap: wrap; }
          .lp-place-card { min-width: 220px; }
        }
      `}</style>
    </div>
  );
}

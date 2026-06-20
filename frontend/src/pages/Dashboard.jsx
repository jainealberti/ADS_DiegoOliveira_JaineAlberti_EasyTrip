import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FiPlus, FiMapPin, FiCalendar, FiDollarSign, FiCpu, FiMap,
  FiCompass, FiStar, FiSearch, FiArrowRight, FiClock, FiHeart,
  FiChevronLeft, FiChevronRight, FiLoader
} from 'react-icons/fi';

const DESTINO_IMAGENS = {
  'rio de janeiro': 'photo-1483729558449-99ef09a8c325',
  'paris': 'photo-1502602898657-3e91760cbb34',
  'gramado': 'photo-1753288378677-ee9423427702',
  'roma': 'photo-1552832230-c0197dd311b5',
  'nova york': 'photo-1496442226666-8d4d0e62e6e9',
  'new york': 'photo-1496442226666-8d4d0e62e6e9',
  'foz do iguaçu': 'photo-1580060839134-75a5edca2e99',
  'salvador': 'photo-1516306580123-e6e52b1b7b5f',
  'lisboa': 'photo-1585208798174-6cedd86e019a',
  'londres': 'photo-1513635269975-59663e0ac1ad',
  'london': 'photo-1513635269975-59663e0ac1ad',
  'tokyo': 'photo-1540959733332-eab4deabeeaf',
  'tóquio': 'photo-1540959733332-eab4deabeeaf',
  'buenos aires': 'photo-1589909202802-8f4aadce1849',
  'barcelona': 'photo-1583422409516-2895a77efed6',
  'amsterdam': 'photo-1534351590666-13e3e96b5f2d',
  'dubai': 'photo-1512453979798-5ea266f8880c',
  'são paulo': 'photo-1554168848-228296d26ce6',
  'florianópolis': 'photo-1594736797933-d0501ba2fe65',
  'curitiba': 'photo-1597137892899-e47e5e57a95f',
  'recife': 'photo-1598981457915-ddd5a3ec5db2',
  'fortaleza': 'photo-1611518040286-9af8ba8be9d4',
  'natal': 'photo-1620050883810-991bf49a0b5c',
  'maceió': 'photo-1590012314607-cda9d9b699ae',
  'berlin': 'photo-1560969184-10fe8719e047',
  'berlim': 'photo-1560969184-10fe8719e047',
  'madrid': 'photo-1543783207-ec64e4d95325',
  'veneza': 'photo-1514890547357-a9ee288728e0',
  'cancún': 'photo-1552074284-5e88ef1aef18',
  'cancun': 'photo-1552074284-5e88ef1aef18',
  'miami': 'photo-1533106497176-45ae19e68ba2',
  'orlando': 'photo-1575089776834-8be34c2bfc93',
};

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&h=400&fit=crop&q=80&auto=format';

function getDestinoImageStatica(destino) {
  if (!destino) return FALLBACK_IMAGE;

  const key = destino.toLowerCase().trim();
  const match = Object.keys(DESTINO_IMAGENS).find(k => key.includes(k) || k.includes(key));

  if (match) {
    return `https://images.unsplash.com/${DESTINO_IMAGENS[match]}?w=600&h=400&fit=crop&q=80&auto=format`;
  }

  return null;
}

function getHeroImage(viagens, imagensDinamicas) {
  if (viagens.length > 0) {
    const ultima = viagens[0];
    const dinamica = imagensDinamicas[ultima.destino];
    if (dinamica) return dinamica;
    const estatica = getDestinoImageStatica(ultima.destino);
    if (estatica) return estatica;
  }
  return FALLBACK_IMAGE;
}

const FEATURES = [
  { icone: FiCompass, titulo: 'Roteiros personalizados', desc: 'Crie uma viagem sob medida com base nos seus dias, cidade, orçamento e preferências.' },
  { icone: FiCpu, titulo: 'Sugestões com IA', desc: 'Receba recomendações inteligentes de passeios, restaurantes e experiências locais.' },
  { icone: FiMap, titulo: 'Mapa interativo', desc: 'Veja os pontos da viagem no mapa, com distâncias, tempos e locais próximos.' },
  { icone: FiStar, titulo: 'Experiências locais', desc: 'Descubra histórias, curiosidades, clima, cultura e lugares especiais.' },
];

export default function Dashboard() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [viagens, setViagens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [imagensDinamicas, setImagensDinamicas] = useState({});
  const scrollRef = useRef(null);

  useEffect(() => {
    carregarViagens();
  }, []);

  useEffect(() => {
    if (viagens.length === 0) return;
    const destinosSemImagem = viagens
      .map(v => v.destino)
      .filter(d => d && !getDestinoImageStatica(d) && !imagensDinamicas[d]);

    const unicos = [...new Set(destinosSemImagem)];
    if (unicos.length === 0) return;

    unicos.forEach(async (destino) => {
      try {
        const res = await api.post('/ia/explorar-destino', { destino });
        if (res.data?.headerImage) {
          setImagensDinamicas(prev => ({ ...prev, [destino]: res.data.headerImage }));
        }
      } catch {
        // silently ignore
      }
    });
  }, [viagens]);

  function getImagemViagem(destino) {
    if (!destino) return FALLBACK_IMAGE;
    const estatica = getDestinoImageStatica(destino);
    if (estatica) return estatica;
    if (imagensDinamicas[destino]) return imagensDinamicas[destino];
    return FALLBACK_IMAGE;
  }

  async function carregarViagens() {
    try {
      const res = await api.get('/viagem/listar');
      setViagens(res.data.viagens);
    } catch (err) {
      console.error('Erro ao carregar viagens:', err);
    } finally {
      setCarregando(false);
    }
  }

  function handleImgError(e) {
    e.target.onerror = null;
    e.target.style.display = 'none';
    if (e.target.parentElement) {
      e.target.parentElement.style.background = 'linear-gradient(135deg, #FF6B35 0%, #ff8f5e 100%)';
    }
  }

  function scrollCards(dir) {
    const el = scrollRef.current;
    if (el) el.scrollBy({ left: dir * 340, behavior: 'smooth' });
  }

  return (
    <div className="dash-page">
      {/* Hero Section */}
      <section className="dash-hero">
        <div className="dash-hero-bg">
          <img
            src={getHeroImage(viagens, imagensDinamicas)}
            alt=""
            className="dash-hero-img"
            onError={handleImgError}
          />
          <div className="dash-hero-overlay" />
        </div>
        <div className="dash-hero-content">
          <span className="dash-hero-badge">
            <FiCpu size={14} />
            Powered by AI
          </span>
          <h1>Olá, {usuario?.nome}!</h1>
          <p className="dash-hero-subtitle">
            Planeje sua viagem ideal com inteligência, praticidade e experiências personalizadas.
          </p>
          <p className="dash-hero-desc">
            O EasyTrip te ajuda a criar roteiros, descobrir passeios, encontrar restaurantes, otimizar tempo e explorar destinos pelo mapa com sugestões da IA.
          </p>
          <Link to="/viagens/nova" className="dash-btn dash-btn-primary dash-btn-lg">
            <FiPlus size={20} /> Criar Nova Viagem
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="dash-section">
        <div className="dash-container">
          <div className="dash-features-grid">
            {FEATURES.map((f, i) => {
              const Icone = f.icone;
              return (
                <div key={i} className="dash-feature-card">
                  <div className="dash-feature-icon"><Icone size={28} /></div>
                  <h3>{f.titulo}</h3>
                  <p>{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Minhas Viagens */}
      <section className="dash-section dash-section-viagens">
        <div className="dash-container">
          <div className="dash-section-header">
            <h2><FiMapPin size={22} /> Minhas Viagens</h2>
            <Link to="/viagens/nova" className="dash-btn dash-btn-primary">
              <FiPlus size={16} /> Nova Viagem
            </Link>
          </div>

          {carregando ? (
            <div className="dash-loading">
              <FiLoader className="dash-spin" size={36} />
              <p>Carregando suas viagens...</p>
            </div>
          ) : viagens.length === 0 ? (
            <div className="dash-empty">
              <FiCompass size={48} />
              <h3>Nenhuma viagem ainda</h3>
              <p>Crie sua primeira viagem e descubra o mundo com roteiros inteligentes!</p>
              <Link to="/viagens/nova" className="dash-btn dash-btn-primary dash-btn-lg">
                <FiPlus size={18} /> Começar minha primeira viagem
              </Link>
            </div>
          ) : (
            <div className="dash-viagens-carousel">
              {viagens.length > 3 && (
                <button className="dash-carousel-arrow dash-carousel-left" onClick={() => scrollCards(-1)} aria-label="Anterior">
                  <FiChevronLeft size={22} />
                </button>
              )}
              <div className="dash-viagens-scroll" ref={scrollRef}>
                {viagens.map((viagem) => (
                  <Link to={`/viagens/${viagem.id_viagem}`} key={viagem.id_viagem} className="dash-viagem-card">
                    <div className="dash-viagem-img">
                      <img
                        src={getImagemViagem(viagem.destino)}
                        alt={viagem.destino}
                        onError={handleImgError}
                      />
                      <div className="dash-viagem-img-overlay">
                        <span className="dash-viagem-destino">{viagem.destino}</span>
                      </div>
                    </div>
                    <div className="dash-viagem-body">
                      <div className="dash-viagem-info">
                        <span><FiCalendar size={14} /> {viagem.quantidade_dias} dia(s)</span>
                        {viagem.orcamento && <span><FiDollarSign size={14} /> R$ {parseFloat(viagem.orcamento).toFixed(2)}</span>}
                      </div>
                      {viagem.meio_transporte && (
                        <span className="dash-viagem-transporte">🚀 {viagem.meio_transporte}</span>
                      )}
                      {viagem.nome_preferencia && (
                        <span className="dash-viagem-pref">{viagem.nome_preferencia.substring(0, 50)}{viagem.nome_preferencia.length > 50 ? '...' : ''}</span>
                      )}
                      <div className="dash-viagem-footer">
                        <small>{new Date(viagem.data_criacao).toLocaleDateString('pt-BR')}</small>
                        <span className="dash-viagem-ver">
                          Ver detalhes <FiArrowRight size={14} />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              {viagens.length > 3 && (
                <button className="dash-carousel-arrow dash-carousel-right" onClick={() => scrollCards(1)} aria-label="Próximo">
                  <FiChevronRight size={22} />
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      {viagens.length > 0 && (
        <section className="dash-cta">
          <div className="dash-container">
            <h2>Pronto para sua próxima aventura?</h2>
            <p>Deixe a IA criar um roteiro perfeito para o seu próximo destino.</p>
            <Link to="/viagens/nova" className="dash-btn dash-btn-primary dash-btn-lg">
              <FiArrowRight size={20} /> Planejar nova viagem
            </Link>
          </div>
        </section>
      )}

      {/* Styles */}
      <style>{`
        .dash-page {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #1a1a2e;
          line-height: 1.6;
        }
        .dash-container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
        .dash-section { padding: 60px 0; }
        .dash-section-viagens { background: #f8f9fc; }

        /* Buttons */
        .dash-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          white-space: nowrap;
        }
        .dash-btn-primary { background: #FF6B35; color: #fff; }
        .dash-btn-primary:hover { background: #e55a2b; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(255,107,53,0.3); }
        .dash-btn-lg { padding: 14px 32px; font-size: 1rem; border-radius: 12px; }

        /* Hero */
        .dash-hero {
          position: relative;
          min-height: 420px;
          display: flex;
          align-items: center;
          overflow: hidden;
        }
        .dash-hero-bg {
          position: absolute;
          inset: 0;
        }
        .dash-hero-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .dash-hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.6) 100%);
        }
        .dash-hero-content {
          position: relative;
          z-index: 2;
          max-width: 1200px;
          margin: 0 auto;
          padding: 60px 24px;
          color: #fff;
        }
        .dash-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,107,53,0.2);
          border: 1px solid rgba(255,107,53,0.4);
          color: #FF6B35;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
          margin-bottom: 20px;
          backdrop-filter: blur(10px);
        }
        .dash-hero-content h1 {
          font-size: 2.5rem;
          font-weight: 800;
          margin-bottom: 12px;
          line-height: 1.2;
        }
        .dash-hero-subtitle {
          font-size: 1.15rem;
          color: rgba(255,255,255,0.9);
          margin-bottom: 8px;
          font-weight: 500;
        }
        .dash-hero-desc {
          font-size: 0.95rem;
          color: rgba(255,255,255,0.75);
          max-width: 600px;
          margin-bottom: 24px;
          line-height: 1.7;
        }

        /* Features */
        .dash-features-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-top: -50px;
          position: relative;
          z-index: 3;
        }
        .dash-feature-card {
          background: #fff;
          border-radius: 14px;
          padding: 28px 20px;
          text-align: center;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .dash-feature-card:hover { transform: translateY(-4px); box-shadow: 0 8px 32px rgba(0,0,0,0.12); }
        .dash-feature-icon {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          background: rgba(255,107,53,0.1);
          color: #FF6B35;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 14px;
        }
        .dash-feature-card h3 { font-size: 0.95rem; font-weight: 600; color: #1a1a2e; margin-bottom: 6px; }
        .dash-feature-card p { font-size: 0.83rem; color: #64748b; line-height: 1.5; }

        /* Section Header */
        .dash-section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
        }
        .dash-section-header h2 {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 1.5rem;
          font-weight: 700;
          color: #1a1a2e;
        }

        /* Loading */
        .dash-loading {
          text-align: center;
          padding: 60px 20px;
        }
        .dash-loading p { color: #64748b; margin-top: 16px; font-size: 1rem; }
        .dash-spin { animation: dash-rotate 1s linear infinite; }
        @keyframes dash-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* Empty State */
        .dash-empty {
          text-align: center;
          padding: 60px 20px;
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }
        .dash-empty svg { color: #FF6B35; margin-bottom: 16px; }
        .dash-empty h3 { font-size: 1.3rem; color: #1a1a2e; margin-bottom: 8px; }
        .dash-empty p { color: #64748b; margin-bottom: 24px; font-size: 1rem; }

        /* Viagens Carousel */
        .dash-viagens-carousel { position: relative; }
        .dash-viagens-scroll {
          display: flex;
          gap: 20px;
          overflow-x: auto;
          padding: 4px 0 16px;
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .dash-viagens-scroll::-webkit-scrollbar { display: none; }
        .dash-carousel-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 5;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: none;
          background: #fff;
          color: #1a1a2e;
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .dash-carousel-arrow:hover { background: #FF6B35; color: #fff; box-shadow: 0 4px 20px rgba(255,107,53,0.35); }
        .dash-carousel-left { left: -18px; }
        .dash-carousel-right { right: -18px; }

        /* Viagem Card */
        .dash-viagem-card {
          min-width: 300px;
          max-width: 320px;
          background: #fff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          scroll-snap-align: start;
          transition: transform 0.3s, box-shadow 0.3s;
          flex-shrink: 0;
          text-decoration: none;
          color: inherit;
          display: flex;
          flex-direction: column;
        }
        .dash-viagem-card:hover {
          transform: translateY(-6px) scale(1.02);
          box-shadow: 0 12px 36px rgba(0,0,0,0.15);
        }
        .dash-viagem-img {
          position: relative;
          height: 180px;
          overflow: hidden;
          background: linear-gradient(135deg, #FF6B35, #ff8f5e);
        }
        .dash-viagem-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s;
        }
        .dash-viagem-card:hover .dash-viagem-img img { transform: scale(1.08); }
        .dash-viagem-img-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%);
          display: flex;
          align-items: flex-end;
          padding: 16px;
        }
        .dash-viagem-destino {
          color: #fff;
          font-size: 1.2rem;
          font-weight: 700;
          text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .dash-viagem-body {
          padding: 16px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .dash-viagem-info {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }
        .dash-viagem-info span {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.88rem;
          color: #475569;
          font-weight: 500;
        }
        .dash-viagem-transporte {
          font-size: 0.83rem;
          color: #64748b;
        }
        .dash-viagem-pref {
          display: inline-block;
          background: rgba(255,107,53,0.1);
          color: #FF6B35;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.78rem;
          font-weight: 600;
          align-self: flex-start;
        }
        .dash-viagem-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: auto;
          padding-top: 10px;
          border-top: 1px solid #f0f4f8;
        }
        .dash-viagem-footer small { color: #94a3b8; font-size: 0.8rem; }
        .dash-viagem-ver {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.83rem;
          color: #FF6B35;
          font-weight: 600;
          transition: gap 0.2s;
        }
        .dash-viagem-card:hover .dash-viagem-ver { gap: 8px; }

        /* CTA */
        .dash-cta {
          padding: 70px 24px;
          background: linear-gradient(135deg, #1a1a2e 0%, #2d2b55 100%);
          text-align: center;
        }
        .dash-cta h2 { color: #fff; font-size: 1.8rem; font-weight: 700; margin-bottom: 10px; }
        .dash-cta p { color: rgba(255,255,255,0.7); font-size: 1.05rem; margin-bottom: 24px; }

        /* Responsive */
        @media (max-width: 1024px) {
          .dash-features-grid { grid-template-columns: repeat(2, 1fr); }
          .dash-viagem-card { min-width: 280px; }
        }
        @media (max-width: 768px) {
          .dash-hero { min-height: 360px; }
          .dash-hero-content { padding: 40px 20px; }
          .dash-hero-content h1 { font-size: 1.8rem; }
          .dash-hero-subtitle { font-size: 1rem; }
          .dash-features-grid { grid-template-columns: 1fr 1fr; margin-top: -30px; gap: 12px; }
          .dash-feature-card { padding: 20px 14px; }
          .dash-feature-card p { font-size: 0.78rem; }
          .dash-section-header { flex-direction: column; align-items: flex-start; gap: 12px; }
          .dash-section-header .dash-btn { width: 100%; justify-content: center; }
          .dash-viagem-card { min-width: 260px; }
          .dash-carousel-arrow { display: none; }
          .dash-cta h2 { font-size: 1.4rem; }
        }
        @media (max-width: 480px) {
          .dash-hero-content h1 { font-size: 1.5rem; }
          .dash-features-grid { grid-template-columns: 1fr; }
          .dash-viagem-card { min-width: 240px; }
          .dash-btn-lg { width: 100%; justify-content: center; }
        }
      `}</style>
    </div>
  );
}

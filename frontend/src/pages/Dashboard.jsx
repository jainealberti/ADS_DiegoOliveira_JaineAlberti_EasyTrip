import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiMapPin, FiCalendar, FiDollarSign, FiCpu, FiMap, FiCompass, FiStar } from 'react-icons/fi';

const FEATURES = [
  { icone: FiCompass, titulo: 'Roteiros personalizados', desc: 'Crie uma viagem sob medida com base nos seus dias, cidade, orçamento e preferências.' },
  { icone: FiCpu, titulo: 'Sugestões com IA', desc: 'Receba recomendações inteligentes de passeios, restaurantes e experiências locais.' },
  { icone: FiMap, titulo: 'Mapa interativo', desc: 'Veja os pontos da viagem no mapa, com distâncias, tempos e locais próximos para explorar.' },
  { icone: FiStar, titulo: 'Experiências locais', desc: 'Descubra histórias, curiosidades, clima, cultura e lugares especiais do destino.' },
];

export default function Dashboard() {
  const { usuario } = useAuth();
  const [viagens, setViagens] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregarViagens();
  }, []);

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

  return (
    <div>
      {/* Hero Section */}
      <div className="hero-section">
        <div className="hero-overlay">
          <div className="hero-content">
            <h1>Olá, {usuario?.nome}!</h1>
            <p className="hero-tagline">Planeje sua viagem ideal com inteligência, praticidade e experiências personalizadas.</p>
            <p className="hero-desc">O EasyTrip te ajuda a criar roteiros, descobrir passeios, encontrar restaurantes, otimizar tempo e explorar destinos pelo mapa com sugestões da IA.</p>
            <Link to="/viagens/nova" className="btn btn-primary btn-hero">
              <FiPlus size={20} /> Criar Nova Viagem
            </Link>
          </div>
        </div>
      </div>

      <div className="container">
        {/* Feature Cards */}
        <div className="features-section">
          <div className="features-grid">
            {FEATURES.map((f, i) => {
              const Icone = f.icone;
              return (
                <div key={i} className="feature-card">
                  <div className="feature-icon"><Icone size={28} /></div>
                  <h3>{f.titulo}</h3>
                  <p>{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Minhas Viagens */}
        <div className="section">
          <div className="section-header">
            <h2><FiMapPin /> Minhas Viagens</h2>
            <Link to="/viagens/nova" className="btn btn-primary">
              <FiPlus size={16} /> Nova Viagem
            </Link>
          </div>

          {carregando ? (
            <div className="loading"><div className="spinner" /></div>
          ) : viagens.length === 0 ? (
            <div className="empty-state-small">
              <p>Nenhuma viagem ainda. Crie sua primeira viagem e descubra o mundo!</p>
            </div>
          ) : (
            <div className="cards-grid">
              {viagens.map((viagem) => (
                <Link to={`/viagens/${viagem.id_viagem}`} key={viagem.id_viagem} className="card">
                  <div className="card-header">
                    <h3><FiMapPin /> {viagem.destino}</h3>
                  </div>
                  <div className="card-body">
                    <p><FiCalendar /> {viagem.quantidade_dias} dia(s)</p>
                    {viagem.orcamento && <p><FiDollarSign /> R$ {parseFloat(viagem.orcamento).toFixed(2)}</p>}
                    {viagem.meio_transporte && <p>🚀 {viagem.meio_transporte}</p>}
                    {viagem.nome_preferencia && <p className="tag">{viagem.nome_preferencia.substring(0, 60)}{viagem.nome_preferencia.length > 60 ? '...' : ''}</p>}
                  </div>
                  <div className="card-footer">
                    <small>{new Date(viagem.data_criacao).toLocaleDateString('pt-BR')}</small>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FiMapPin, FiClock, FiDollarSign, FiChevronDown, FiChevronRight, FiInfo } from 'react-icons/fi';
import api from '../services/api';

const TIPO_CORES = {
  ponto_turistico: '#FF6B35', restaurante: '#e74c3c', cultural: '#8e44ad',
  natureza: '#27ae60', compras: '#f39c12', vida_noturna: '#2c3e50', experiencia_local: '#00b894'
};
const TIPO_EMOJI = {
  ponto_turistico: '📍', restaurante: '🍽️', cultural: '🏛️',
  natureza: '🌿', compras: '🛍️', vida_noturna: '🌙', experiencia_local: '⭐'
};

export default function RoteiroPublico() {
  const { share_token } = useParams();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [diasAbertos, setDiasAbertos] = useState({});
  const [infoCidadeAberta, setInfoCidadeAberta] = useState(false);

  useEffect(() => {
    async function carregar() {
      try {
        const res = await api.get(`/roteiro/publico/${share_token}`);
        setDados(res.data);
        const abertos = {};
        res.data.dias.forEach(d => { abertos[d.dia] = true; });
        setDiasAbertos(abertos);
      } catch {
        setErro('Roteiro não encontrado ou não está mais disponível.');
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [share_token]);

  function toggleDia(dia) {
    setDiasAbertos(p => ({ ...p, [dia]: !p[dia] }));
  }

  if (carregando) return <div className="loading-page"><div className="spinner" /></div>;

  if (erro) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '3rem 2rem', textAlign: 'center', maxWidth: 440, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 48, marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ color: '#2d3436', marginBottom: '0.5rem' }}>Roteiro indisponível</h2>
          <p style={{ color: '#636e72' }}>{erro}</p>
        </div>
      </div>
    );
  }

  const { roteiro, viagem, dias, metadados } = dados;
  const infoCidade = metadados?.info_cidade || {};
  const custoTotal = dias.reduce((total, d) => total + d.atividades.reduce((acc, a) => acc + (parseFloat(a.custo_estimado) || 0), 0), 0);
  const totalAtividades = dias.reduce((acc, d) => acc + d.atividades.length, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa' }}>
      <div style={{ background: 'linear-gradient(135deg, #FF6B35, #ff8f5e)', padding: '1.5rem 2rem', textAlign: 'center' }}>
        <h1 style={{ color: '#fff', fontSize: '1.6rem', fontWeight: 700 }}>EasyTrip</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem', marginTop: 4 }}>Planejador Inteligente de Viagens</p>
      </div>

      <div className="container" style={{ maxWidth: 900 }}>
        <div style={{ background: '#fff3ed', border: '1px solid #ffdcc8', borderRadius: 10, padding: '0.8rem 1.2rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#e55a28', textAlign: 'center' }}>
          Este roteiro foi compartilhado por um usuário EasyTrip.
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: '2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.4rem', color: '#2d3436', marginBottom: '1rem' }}>{roteiro.titulo}</h2>
          {roteiro.descricao && <p style={{ color: '#636e72', marginBottom: '1rem', lineHeight: 1.6 }}>{roteiro.descricao}</p>}

          <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', fontSize: '0.9rem', color: '#636e72' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FiMapPin /> {viagem.destino}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FiClock /> {viagem.quantidade_dias} dia(s)</span>
            {viagem.orcamento && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FiDollarSign /> R$ {parseFloat(viagem.orcamento).toFixed(2)}</span>}
            {viagem.nome_preferencia && <span className="tag">{viagem.nome_preferencia}</span>}
            {viagem.meio_transporte && <span className="tag">{viagem.meio_transporte}</span>}
          </div>

          {custoTotal > 0 && (
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem', padding: '0.8rem 1rem', background: '#f0faf4', borderRadius: 10, border: '1px solid #d4efdf' }}>
              <span style={{ fontWeight: 600, color: '#27ae60', fontSize: '0.9rem' }}>💰 Custo total estimado: R$ {custoTotal.toFixed(2)}</span>
              <span style={{ color: '#636e72', fontSize: '0.85rem' }}>| {totalAtividades} atividades</span>
            </div>
          )}
        </div>

        {infoCidade.historia && (
          <div className="cidade-info-panel">
            <div className="cidade-info-header" onClick={() => setInfoCidadeAberta(!infoCidadeAberta)}>
              <span><FiInfo /> Sobre {viagem.destino}</span>
              {infoCidadeAberta ? <FiChevronDown /> : <FiChevronRight />}
            </div>
            {infoCidadeAberta && (
              <div className="cidade-info-body">
                <div className="cidade-info-grid">
                  <div><strong>Sobre a cidade</strong><p>{infoCidade.historia}</p></div>
                  {infoCidade.curiosidades && <div><strong>Curiosidades</strong><p>{infoCidade.curiosidades}</p></div>}
                  {infoCidade.clima && <div><strong>Clima</strong><p>{infoCidade.clima}</p></div>}
                  {infoCidade.gastronomia && <div><strong>Gastronomia</strong><p>{infoCidade.gastronomia}</p></div>}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="dias-grid" style={{ gridTemplateColumns: '1fr' }}>
          {dias.map(diaObj => {
            const aberto = diasAbertos[diaObj.dia] || false;
            const custoDia = diaObj.atividades.reduce((acc, a) => acc + (parseFloat(a.custo_estimado) || 0), 0);
            return (
              <div key={diaObj.dia} className="accordion-item">
                <div className="accordion-header" onClick={() => toggleDia(diaObj.dia)}>
                  <div className="accordion-title">
                    {aberto ? <FiChevronDown size={20} /> : <FiChevronRight size={20} />}
                    <h2>Dia {diaObj.dia}</h2>
                    <span className="accordion-badge">{diaObj.atividades.length} atividades</span>
                    {custoDia > 0 && <span className="accordion-badge" style={{ background: '#27ae60', marginLeft: '0.4rem' }}>💰 R$ {custoDia.toFixed(2)}</span>}
                  </div>
                </div>
                {aberto && (
                  <div className="accordion-body">
                    <div className="atividades-list">
                      {diaObj.atividades.map((ativ, i) => (
                        <div key={i} className="atividade-card" style={{ cursor: 'default' }}>
                          <div className="atividade-info">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span className="ativ-numero" style={{ background: TIPO_CORES[ativ.tipo] || '#FF6B35' }}>{i + 1}</span>
                              <h4>{TIPO_EMOJI[ativ.tipo] || '📍'} {ativ.nome_atividade}</h4>
                            </div>
                            <div className="atividade-meta">
                              {ativ.horario && <span><FiClock /> {ativ.horario}</span>}
                              {ativ.local && <span><FiMapPin /> {ativ.local}</span>}
                              <span style={{ color: parseFloat(ativ.custo_estimado) > 0 ? '#27ae60' : '#7f8c8d' }}>
                                <FiDollarSign /> {parseFloat(ativ.custo_estimado) > 0 ? `R$ ${parseFloat(ativ.custo_estimado).toFixed(2)}` : 'Gratuito'}
                              </span>
                              {ativ.tempo_visita && <span>🕐 {ativ.tempo_visita}</span>}
                            </div>
                            {ativ.descricao && <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#555', lineHeight: 1.6 }}>{ativ.descricao}</p>}
                          </div>
                        </div>
                      ))}
                      {diaObj.atividades.length === 0 && <p className="empty-dia">Nenhuma atividade neste dia.</p>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', padding: '2rem 0', color: '#b2bec3', fontSize: '0.85rem' }}>
          <p>Roteiro gerado com <strong style={{ color: '#FF6B35' }}>EasyTrip</strong></p>
          <p style={{ marginTop: 4 }}>Crie seu próprio roteiro inteligente de viagem!</p>
        </div>
      </div>
    </div>
  );
}

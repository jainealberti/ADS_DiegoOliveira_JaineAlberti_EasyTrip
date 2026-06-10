import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { FiMapPin, FiCalendar, FiTrash2, FiEdit, FiCpu, FiList, FiArrowLeft } from 'react-icons/fi';

export default function DetalhesViagem() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [viagem, setViagem] = useState(null);
  const [roteiros, setRoteiros] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    carregarDados();
  }, [id]);

  async function carregarDados() {
    try {
      const [viagemRes, roteirosRes] = await Promise.all([
        api.get(`/viagem/${id}`),
        api.get('/roteiro/listar'),
      ]);
      setViagem(viagemRes.data.viagem);
      setRoteiros(roteirosRes.data.roteiros.filter((r) => r.fk_viagem_id_viagem == id));
    } catch (err) {
      setErro('Erro ao carregar dados da viagem.');
    } finally {
      setCarregando(false);
    }
  }

  async function gerarRoteiro() {
    setGerando(true);
    setErro('');
    setSucesso('');

    try {
      const res = await api.post('/roteiro/gerar', { id_viagem: parseInt(id) });
      if (!res.data.roteiro) {
        setErro(res.data.mensagem || 'Erro ao gerar roteiro.');
      } else {
        setSucesso(res.data.mensagem || 'Roteiro gerado com sucesso!');
        carregarDados();
      }
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Erro ao gerar roteiro.');
    } finally {
      setGerando(false);
    }
  }

  async function excluirViagem() {
    if (!window.confirm('Tem certeza que deseja excluir esta viagem? Todos os roteiros e custos serão removidos.')) return;

    try {
      await api.delete(`/viagem/${id}`);
      navigate('/dashboard');
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Erro ao excluir viagem.');
    }
  }

  async function excluirRoteiro(id_roteiro) {
    if (!window.confirm('Excluir este roteiro e todas as atividades?')) return;

    try {
      await api.delete(`/roteiro/excluir/${id_roteiro}`);
      setSucesso('Roteiro excluído!');
      carregarDados();
    } catch (err) {
      setErro('Erro ao excluir roteiro.');
    }
  }

  if (carregando) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  if (!viagem) {
    return <div className="container"><p>Viagem não encontrada.</p></div>;
  }

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1><FiMapPin /> {viagem.destino}</h1>
          <p>{viagem.quantidade_dias} dia(s) {viagem.orcamento ? `• Orçamento: R$ ${parseFloat(viagem.orcamento).toFixed(2)}` : ''}</p>
        </div>
        <div className="header-actions">
          <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
            <FiArrowLeft /> Voltar
          </button>
          <Link to={`/viagens/${id}/custos`} className="btn btn-secondary">
            <span style={{ fontWeight: 'bold', fontSize: '1.1em' }}>R$</span> Inserir Custos da Viagem!
          </Link>
          <button onClick={excluirViagem} className="btn btn-danger">
            <FiTrash2 /> Excluir
          </button>
        </div>
      </div>

      {erro && <div className="alert alert-erro">{erro}</div>}
      {sucesso && <div className="alert alert-sucesso">{sucesso}</div>}

      <div className="section">
        <div className="section-header">
          <h2><FiList /> Roteiros</h2>
          <button onClick={gerarRoteiro} className="btn btn-primary" disabled={gerando}>
            <FiCpu /> {gerando ? 'Gerando roteiro...' : 'Gerar Roteiro com IA'}
          </button>
        </div>

        {gerando && (
          <div className="loading-ia">
            <div className="spinner" />
            <p>Gerando roteiro inteligente para {viagem.destino}...</p>
            <small>Isso pode levar alguns segundos</small>
          </div>
        )}

        {roteiros.length === 0 && !gerando ? (
          <div className="empty-state-small">
            <p>Nenhum roteiro gerado ainda. Clique em "Gerar Roteiro com IA" para começar!</p>
          </div>
        ) : (
          <div className="cards-grid">
            {roteiros.map((roteiro) => (
              <div key={roteiro.id_roteiro} className="card">
                <div className="card-header">
                  <h3>{roteiro.titulo}</h3>
                </div>
                <div className="card-body">
                  <p>{roteiro.descricao}</p>
                  <span className="tag">{roteiro.status}</span>
                </div>
                <div className="card-footer">
                  <Link to={`/roteiros/${roteiro.id_roteiro}`} className="btn btn-sm btn-primary">
                    <FiEdit /> Ver Detalhes
                  </Link>
                  <button onClick={() => excluirRoteiro(roteiro.id_roteiro)} className="btn btn-sm btn-danger">
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

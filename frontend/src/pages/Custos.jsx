import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { FiDollarSign, FiPlus, FiTrash2, FiArrowLeft, FiCamera, FiX, FiImage } from 'react-icons/fi';

const API_BASE = 'http://localhost:3001';

export default function Custos() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [custos, setCustos] = useState([]);
  const [total, setTotal] = useState(0);
  const [viagem, setViagem] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [fotoPreview, setFotoPreview] = useState(null);
  const [fotoArquivo, setFotoArquivo] = useState(null);
  const [fotoExpandida, setFotoExpandida] = useState(null);
  const inputFotoRef = useRef(null);

  const [novoCusto, setNovoCusto] = useState({
    categoria: 'Transporte',
    descricao: '',
    valor: '',
  });

  const categorias = ['Transporte', 'Hospedagem', 'Alimentação', 'Passeios', 'Compras', 'Outros'];

  useEffect(() => {
    carregarDados();
  }, [id]);

  async function carregarDados() {
    try {
      const [viagemRes, custosRes, totalRes] = await Promise.all([
        api.get(`/viagem/${id}`),
        api.get(`/custo/listar/${id}`),
        api.get(`/custo/total/${id}`),
      ]);
      setViagem(viagemRes.data.viagem);
      setCustos(custosRes.data.custos);
      setTotal(totalRes.data.total);
    } catch (err) {
      setErro('Erro ao carregar custos.');
    } finally {
      setCarregando(false);
    }
  }

  function handleFotoCaptura(e) {
    const file = e.target.files[0];
    if (!file) return;

    setFotoArquivo(file);
    const reader = new FileReader();
    reader.onloadend = () => setFotoPreview(reader.result);
    reader.readAsDataURL(file);
  }

  function removerFoto() {
    setFotoArquivo(null);
    setFotoPreview(null);
    if (inputFotoRef.current) inputFotoRef.current.value = '';
  }

  async function adicionarCusto(e) {
    e.preventDefault();
    setErro('');

    try {
      const formData = new FormData();
      formData.append('id_viagem', parseInt(id));
      formData.append('categoria', novoCusto.categoria);
      formData.append('descricao', novoCusto.descricao);
      formData.append('valor', parseFloat(novoCusto.valor));

      if (fotoArquivo) {
        formData.append('foto_despesa', fotoArquivo);
      }

      await api.post('/custo/adicionar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSucesso('Custo adicionado!');
      setNovoCusto({ categoria: 'Transporte', descricao: '', valor: '' });
      removerFoto();
      setMostrarForm(false);
      carregarDados();
      setTimeout(() => setSucesso(''), 2000);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Erro ao adicionar custo.');
    }
  }

  async function excluirCusto(id_custo) {
    if (!window.confirm('Excluir este custo?')) return;
    try {
      await api.delete(`/custo/excluir/${id_custo}`);
      setSucesso('Custo excluído!');
      carregarDados();
      setTimeout(() => setSucesso(''), 2000);
    } catch (err) {
      setErro('Erro ao excluir custo.');
    }
  }

  if (carregando) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1><FiDollarSign /> Custos - {viagem?.destino}</h1>
          <p>Gerencie os gastos da sua viagem</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => navigate(`/viagens/${id}`)}>
            <FiArrowLeft /> Voltar
          </button>
          <button className="btn btn-primary" onClick={() => setMostrarForm(!mostrarForm)}>
            <FiPlus /> Novo Custo
          </button>
        </div>
      </div>

      {erro && <div className="alert alert-erro">{erro}</div>}
      {sucesso && <div className="alert alert-sucesso">{sucesso}</div>}

      <div className="custo-total-card">
        <h3>Total de Gastos</h3>
        <p className="valor-total">R$ {total.toFixed(2)}</p>
        {viagem?.orcamento && (
          <p className="orcamento-info">
            Orçamento: R$ {parseFloat(viagem.orcamento).toFixed(2)}
            {total > parseFloat(viagem.orcamento)
              ? <span className="over-budget"> (Acima do orçamento!)</span>
              : <span className="under-budget"> (Dentro do orçamento)</span>
            }
          </p>
        )}
      </div>

      {mostrarForm && (
        <div className="form-card">
          <h3>Adicionar Custo</h3>
          <form onSubmit={adicionarCusto}>
            <div className="input-group">
              <select
                value={novoCusto.categoria}
                onChange={(e) => setNovoCusto({ ...novoCusto, categoria: e.target.value })}
              >
                {categorias.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <input
                type="text"
                placeholder="Descrição"
                value={novoCusto.descricao}
                onChange={(e) => setNovoCusto({ ...novoCusto, descricao: e.target.value })}
              />
            </div>
            <div className="input-group">
              <input
                type="number"
                placeholder="Valor (R$)"
                value={novoCusto.valor}
                onChange={(e) => setNovoCusto({ ...novoCusto, valor: e.target.value })}
                step="0.01"
                min="0.01"
                required
              />
            </div>

            <div className="foto-despesa-section">
              <label className="foto-despesa-label">Foto da Despesa (opcional)</label>
              <input
                ref={inputFotoRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFotoCaptura}
                id="foto-despesa-input"
                className="foto-despesa-input-hidden"
              />
              {!fotoPreview ? (
                <button
                  type="button"
                  className="btn-captura-foto"
                  onClick={() => inputFotoRef.current?.click()}
                >
                  <FiCamera size={22} />
                  <span>Tirar Foto / Escolher Imagem</span>
                </button>
              ) : (
                <div className="foto-preview-container">
                  <img src={fotoPreview} alt="Preview da despesa" className="foto-preview-img" />
                  <div className="foto-preview-actions">
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => inputFotoRef.current?.click()}>
                      <FiCamera /> Trocar
                    </button>
                    <button type="button" className="btn btn-sm btn-secondary btn-icon-danger-text" onClick={removerFoto}>
                      <FiX /> Remover
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => { setMostrarForm(false); removerFoto(); }}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">Adicionar</button>
            </div>
          </form>
        </div>
      )}

      {custos.length === 0 ? (
        <div className="empty-state-small">
          <p>Nenhum custo registrado. Clique em &quot;Novo Custo&quot; para adicionar.</p>
        </div>
      ) : (
        <div className="custos-table">
          <table>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Descrição</th>
                <th>Valor</th>
                <th>Comprovante</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {custos.map((custo) => (
                <tr key={custo.id_custo}>
                  <td><span className="tag">{custo.categoria}</span></td>
                  <td>{custo.descricao || '-'}</td>
                  <td>R$ {parseFloat(custo.valor).toFixed(2)}</td>
                  <td>
                    {custo.foto_despesa ? (
                      <button
                        className="btn-foto-thumb"
                        onClick={() => setFotoExpandida(`${API_BASE}${custo.foto_despesa}`)}
                        title="Ver comprovante"
                      >
                        <img
                          src={`${API_BASE}${custo.foto_despesa}`}
                          alt="Comprovante"
                          className="foto-thumb"
                        />
                      </button>
                    ) : (
                      <span className="sem-foto">-</span>
                    )}
                  </td>
                  <td>
                    <button className="btn-icon btn-icon-danger" onClick={() => excluirCusto(custo.id_custo)}>
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {fotoExpandida && (
        <div className="modal-overlay" onClick={() => setFotoExpandida(null)}>
          <div className="modal-foto-content" onClick={e => e.stopPropagation()}>
            <button className="modal-foto-close" onClick={() => setFotoExpandida(null)}>
              <FiX size={24} />
            </button>
            <img src={fotoExpandida} alt="Comprovante ampliado" className="foto-expandida-img" />
          </div>
        </div>
      )}
    </div>
  );
}

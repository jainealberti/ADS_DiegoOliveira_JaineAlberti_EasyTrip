import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  FiMapPin, FiCalendar, FiDollarSign, FiCpu, FiHeart,
  FiTruck, FiEdit3, FiLoader, FiRefreshCw
} from 'react-icons/fi';

const CIDADES_POPULARES = [
  'Paris, França', 'Tokyo, Japão', 'Nova York, EUA', 'Londres, Inglaterra',
  'Roma, Itália', 'Barcelona, Espanha', 'Dubai, Emirados Árabes', 'Bangkok, Tailândia',
  'Istambul, Turquia', 'Amsterdã, Holanda', 'Lisboa, Portugal', 'Berlim, Alemanha',
  'Cancún, México', 'Buenos Aires, Argentina', 'Santiago, Chile',
  'Rio de Janeiro, Brasil', 'São Paulo, Brasil', 'Salvador, Brasil',
  'Florianópolis, Brasil', 'Gramado, Brasil', 'Foz do Iguaçu, Brasil',
  'Recife, Brasil', 'Fortaleza, Brasil', 'Curitiba, Brasil', 'Belo Horizonte, Brasil',
  'Natal, Brasil', 'Maceió, Brasil', 'Porto de Galinhas, Brasil',
  'Bonito, Brasil', 'Campos do Jordão, Brasil', 'Paraty, Brasil',
  'Jericoacoara, Brasil', 'Fernando de Noronha, Brasil', 'Manaus, Brasil',
  'Chapada dos Veadeiros, Brasil', 'Monte Verde, Brasil',
  'Sydney, Austrália', 'Cidade do Cabo, África do Sul', 'Marrakech, Marrocos',
  'Cairo, Egito', 'Cusco, Peru', 'Cartagena, Colômbia',
  'San Francisco, EUA', 'Miami, EUA', 'Toronto, Canadá',
  'Praga, República Tcheca', 'Viena, Áustria', 'Budapeste, Hungria'
];

const TRANSPORTES = [
  { id: 'aviao', nome: 'Avião', emoji: '✈️' },
  { id: 'onibus', nome: 'Ônibus', emoji: '🚌' },
  { id: 'carro', nome: 'Carro', emoji: '🚗' },
  { id: 'moto', nome: 'Moto', emoji: '🏍️' },
  { id: 'trem', nome: 'Trem', emoji: '🚆' },
  { id: 'outro', nome: 'Outro', emoji: '🚶' },
];

const PREFERENCIAS_FALLBACK = [
  { id: 'gastronomia', nome: 'Gastronomia' },
  { id: 'pontos_turisticos', nome: 'Pontos turísticos' },
  { id: 'cultura', nome: 'Cultura local' },
  { id: 'natureza', nome: 'Natureza e parques' },
  { id: 'compras', nome: 'Compras' },
  { id: 'vida_noturna', nome: 'Vida noturna' },
  { id: 'passeios_familia', nome: 'Passeios em família' },
  { id: 'aventura', nome: 'Aventura' },
  { id: 'romantico', nome: 'Experiências românticas' },
  { id: 'relaxamento', nome: 'Relaxamento e spa' },
];

export default function NovaViagem() {
  const [destino, setDestino] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [orcamento, setOrcamento] = useState('');
  const [transporte, setTransporte] = useState('');
  const [detalhesExtra, setDetalhesExtra] = useState('');
  const [prefsIA, setPrefsIA] = useState([]);
  const [prefsSelecionadas, setPrefsSelecionadas] = useState([]);
  const [prefCustom, setPrefCustom] = useState('');
  const [carregandoPrefs, setCarregandoPrefs] = useState(false);
  const [erroPrefs, setErroPrefs] = useState('');
  const [cidadePrefsCarregada, setCidadePrefsCarregada] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [etapa, setEtapa] = useState('');
  const navigate = useNavigate();
  const sugestoesRef = useRef(null);
  const debounceRef = useRef(null);

  const quantidadeDias = dataInicio && dataFim
    ? Math.max(1, Math.ceil((new Date(dataFim) - new Date(dataInicio)) / (1000 * 60 * 60 * 24)) + 1)
    : 0;

  useEffect(() => {
    function handleClickFora(e) {
      if (sugestoesRef.current && !sugestoesRef.current.contains(e.target)) {
        setMostrarSugestoes(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  const buscarPreferenciasIA = useCallback(async (cidade) => {
    if (!cidade || cidade.length < 2) return;

    setCidadePrefsCarregada(cidade);
    setCarregandoPrefs(true);
    setErroPrefs('');
    setPrefsIA([]);

    try {
      const res = await api.post('/ia/preferencias', { cidade });
      const prefs = res.data?.preferencias;

      if (Array.isArray(prefs) && prefs.length > 0) {
        setPrefsIA(prefs);
      } else {
        setPrefsIA(PREFERENCIAS_FALLBACK);
        setErroPrefs('Usando sugestões padrão.');
      }
    } catch (err) {
      console.error('Erro ao buscar preferências:', err);
      setPrefsIA(PREFERENCIAS_FALLBACK);
      setErroPrefs('Não foi possível carregar sugestões personalizadas. Mostrando sugestões padrão.');
    } finally {
      setCarregandoPrefs(false);
    }
  }, []);

  function handleDestinoChange(valor) {
    setDestino(valor);

    if (valor.length >= 2) {
      const filtradas = CIDADES_POPULARES.filter((c) =>
        c.toLowerCase().includes(valor.toLowerCase())
      ).slice(0, 8);
      setSugestoes(filtradas);
      setMostrarSugestoes(filtradas.length > 0);
    } else {
      setMostrarSugestoes(false);
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (valor.length >= 3) {
      debounceRef.current = setTimeout(() => {
        buscarPreferenciasIA(valor);
      }, 1500);
    } else {
      setPrefsIA([]);
      setCidadePrefsCarregada('');
      setErroPrefs('');
    }
  }

  function selecionarCidade(cidade) {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    setDestino(cidade);
    setMostrarSugestoes(false);
    setPrefsSelecionadas([]);
    buscarPreferenciasIA(cidade);
  }

  function togglePreferencia(nome) {
    setPrefsSelecionadas((prev) =>
      prev.includes(nome) ? prev.filter((p) => p !== nome) : [...prev, nome]
    );
  }

  function montarPreferencias() {
    const todas = [...prefsSelecionadas];
    if (prefCustom.trim()) todas.push(prefCustom.trim());
    return todas.join(', ');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    if (!destino) return setErro('Selecione um destino.');
    if (!dataInicio || !dataFim) return setErro('Selecione as datas da viagem.');
    if (new Date(dataFim) < new Date(dataInicio)) return setErro('A data final deve ser depois da inicial.');

    setCarregando(true);
    setEtapa('Criando viagem...');

    try {
      const res = await api.post('/viagem/criar', {
        destino,
        quantidade_dias: quantidadeDias,
        orcamento: orcamento ? parseFloat(orcamento) : null,
        nome_preferencia: montarPreferencias() || null,
        meio_transporte: transporte || null,
        detalhes_extra: detalhesExtra || null,
      });

      const idViagem = res.data.viagem.id_viagem;
      setEtapa('Buscando lugares e gerando roteiro...');
      const roteiroRes = await api.post('/roteiro/gerar', { id_viagem: idViagem });
      if (!roteiroRes.data.roteiro) {
        setErro(roteiroRes.data.mensagem || 'Erro ao gerar roteiro.');
        return;
      }
      navigate(`/roteiros/${roteiroRes.data.roteiro.id_roteiro}`);
    } catch (err) {
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setErro('A geração demorou mais que o esperado. Tente novamente.');
      } else {
        setErro(err.response?.data?.mensagem || 'Erro ao criar viagem e gerar roteiro. Verifique o console do servidor.');
      }
    } finally {
      setCarregando(false);
      setEtapa('');
    }
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1><FiMapPin /> Nova Viagem</h1>
      </div>

      <div className="form-card">
        <form onSubmit={handleSubmit}>
          {erro && <div className="alert alert-erro">{erro}</div>}

          <label className="form-label"><FiMapPin /> Cidade / Destino</label>
          <div className="autocomplete-wrapper" ref={sugestoesRef}>
            <div className="input-group">
              <FiMapPin className="input-icon" />
              <input
                type="text"
                placeholder="Digite o nome da cidade..."
                value={destino}
                onChange={(e) => handleDestinoChange(e.target.value)}
                onFocus={() => destino.length >= 2 && sugestoes.length > 0 && setMostrarSugestoes(true)}
                disabled={carregando}
              />
            </div>
            {mostrarSugestoes && (
              <ul className="autocomplete-list">
                {sugestoes.map((cidade) => (
                  <li key={cidade} onClick={() => selecionarCidade(cidade)}>
                    <FiMapPin size={14} /> {cidade}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="form-label"><FiCalendar /> Dias da Viagem</label>
          <div className="date-range">
            <div className="input-group">
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} min={new Date().toISOString().split('T')[0]} disabled={carregando} />
            </div>
            <span className="date-separator">até</span>
            <div className="input-group">
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} min={dataInicio || new Date().toISOString().split('T')[0]} disabled={carregando} />
            </div>
          </div>
          {quantidadeDias > 0 && <p className="date-info">{quantidadeDias} dia(s) de viagem</p>}

          <label className="form-label"><FiTruck /> Como você vai viajar?</label>
          <div className="prefs-grid">
            {TRANSPORTES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`pref-chip ${transporte === t.id ? 'pref-chip-active' : ''}`}
                onClick={() => setTransporte(transporte === t.id ? '' : t.id)}
                disabled={carregando}
              >
                <span>{t.emoji}</span>
                <span>{t.nome}</span>
              </button>
            ))}
          </div>

          <label className="form-label"><FiDollarSign /> Orçamento (opcional)</label>
          <div className="input-group">
            <FiDollarSign className="input-icon" />
            <input type="number" placeholder="Orçamento total em R$" value={orcamento} onChange={(e) => setOrcamento(e.target.value)} min="0" step="0.01" disabled={carregando} />
          </div>

          <label className="form-label">
            <FiHeart /> Preferências
            {cidadePrefsCarregada && <span className="pref-hint"> — sugestões para {cidadePrefsCarregada}</span>}
          </label>

          {carregandoPrefs ? (
            <div className="prefs-loading">
              <FiLoader className="spin-icon" />
              <span>Buscando sugestões personalizadas para {destino}...</span>
            </div>
          ) : prefsIA.length > 0 ? (
            <>
              {erroPrefs && <p className="prefs-fallback-msg">{erroPrefs}</p>}
              <div className="prefs-grid">
                {prefsIA.map((pref) => {
                  const ativo = prefsSelecionadas.includes(pref.nome);
                  return (
                    <button
                      key={pref.id}
                      type="button"
                      className={`pref-chip ${ativo ? 'pref-chip-active' : ''}`}
                      onClick={() => togglePreferencia(pref.nome)}
                      disabled={carregando}
                    >
                      <span>✨</span>
                      <span>{pref.nome}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : destino.length >= 3 ? (
            <div className="prefs-empty">
              <p>Nenhuma sugestão encontrada para "{destino}".</p>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => buscarPreferenciasIA(destino)}
              >
                <FiRefreshCw size={14} /> Tentar novamente
              </button>
            </div>
          ) : (
            <p className="prefs-hint-text">Selecione ou digite uma cidade para ver sugestões personalizadas</p>
          )}

          <div className="input-group" style={{ marginTop: '0.5rem' }}>
            <input type="text" placeholder="Preferência personalizada (opcional)" value={prefCustom} onChange={(e) => setPrefCustom(e.target.value)} style={{ paddingLeft: '0.8rem' }} disabled={carregando} />
          </div>

          <label className="form-label"><FiEdit3 /> Algum detalhe extra para tornar sua viagem perfeita?</label>
          <div className="input-group">
            <textarea
              className="textarea-field"
              placeholder="Ex: Vou com crianças, prefiro evitar caminhadas longas, quero restaurantes veganos, busco experiências locais autênticas..."
              value={detalhesExtra}
              onChange={(e) => setDetalhesExtra(e.target.value)}
              rows={3}
              disabled={carregando}
            />
          </div>

          {carregando && (
            <div className="loading-ia">
              <div className="spinner" />
              <p>{etapa}</p>
              <small>Criando o Roteriro ideal para sua viagem!. Isso pode levar alguns segundos.</small>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/dashboard')} disabled={carregando}>Cancelar</button>
            <button type="submit" className="btn btn-primary btn-gerar" disabled={carregando}>
              <FiCpu size={18} />
              {carregando ? etapa : 'Gerar Roteiro com IA'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { FiSend, FiMessageCircle, FiUser, FiCpu } from 'react-icons/fi';

export default function ChatIA() {
  const { usuario } = useAuth();
  const [mensagens, setMensagens] = useState([
    { role: 'assistant', content: `Olá, ${usuario?.nome}! 👋 Sou o assistente de viagens do EasyTrip. Posso te ajudar com dicas de passeios, restaurantes, pontos turísticos, clima, curiosidades e sugestões de viagem. Qual destino você quer explorar?` }
  ]);
  const [input, setInput] = useState('');
  const [enviando, setEnviando] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  async function enviarMensagem(e) {
    e.preventDefault();
    if (!input.trim() || enviando) return;

    const novaMensagem = input.trim();
    setInput('');
    setMensagens((prev) => [...prev, { role: 'user', content: novaMensagem }]);
    setEnviando(true);

    try {
      const res = await api.post('/ia/chat', {
        mensagem: novaMensagem,
        contexto: {}
      });
      setMensagens((prev) => [...prev, { role: 'assistant', content: res.data.resposta }]);
    } catch {
      setMensagens((prev) => [...prev, { role: 'assistant', content: 'Desculpe, ocorreu um erro. Tente novamente.' }]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1><FiMessageCircle /> Chat com IA</h1>
        <p className="chat-subtitle">Peça dicas de passeios, restaurantes, pontos turísticos e muito mais</p>
      </div>

      <div className="chat-container">
        <div className="chat-messages">
          {mensagens.map((msg, i) => (
            <div key={i} className={`chat-msg ${msg.role === 'user' ? 'chat-msg-user' : 'chat-msg-ia'}`}>
              <div className="chat-msg-avatar">
                {msg.role === 'user' ? <FiUser size={18} /> : <FiCpu size={18} />}
              </div>
              <div className="chat-msg-content">
                <div className="chat-msg-bubble">{msg.content}</div>
              </div>
            </div>
          ))}
          {enviando && (
            <div className="chat-msg chat-msg-ia">
              <div className="chat-msg-avatar"><FiCpu size={18} /></div>
              <div className="chat-msg-content">
                <div className="chat-msg-bubble chat-typing">
                  <span className="dot"></span><span className="dot"></span><span className="dot"></span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form className="chat-input-bar" onSubmit={enviarMensagem}>
          <input
            type="text"
            placeholder="Pergunte sobre destinos, dicas, restaurantes..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={enviando}
          />
          <button type="submit" disabled={enviando || !input.trim()} className="btn btn-primary">
            <FiSend size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

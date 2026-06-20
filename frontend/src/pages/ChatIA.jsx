import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { FiSend, FiMessageCircle, FiUser, FiCpu } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';

export default function ChatIA() {
  const { usuario } = useAuth();
  const [mensagens, setMensagens] = useState([
    { role: 'assistant', content: `Olá, ${usuario?.nome}! 👋 Sou o assistente de viagens do EasyTrip. Posso te ajudar com dicas de passeios, restaurantes, pontos turísticos, clima, curiosidades e sugestões de viagem.\n\nTambém posso te **mostrar seus roteiros** — é só pedir! Qual destino você quer explorar?` }
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

    const mensagensAtualizadas = [...mensagens, { role: 'user', content: novaMensagem }];
    setMensagens(mensagensAtualizadas);
    setEnviando(true);

    try {
      const historico = mensagensAtualizadas.slice(1).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

      const res = await api.post('/ia/chat', {
        mensagem: novaMensagem,
        contexto: {},
        historico: historico.slice(-10),
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
                <div className="chat-msg-bubble">
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p style={{ margin: '0.3em 0' }}>{children}</p>,
                        ul: ({ children }) => <ul style={{ margin: '0.3em 0', paddingLeft: '1.2em' }}>{children}</ul>,
                        ol: ({ children }) => <ol style={{ margin: '0.3em 0', paddingLeft: '1.2em' }}>{children}</ol>,
                        li: ({ children }) => <li style={{ margin: '0.2em 0' }}>{children}</li>,
                        strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
                        h1: ({ children }) => <h3 style={{ margin: '0.5em 0 0.2em', fontSize: '1.1em' }}>{children}</h3>,
                        h2: ({ children }) => <h3 style={{ margin: '0.5em 0 0.2em', fontSize: '1.05em' }}>{children}</h3>,
                        h3: ({ children }) => <h4 style={{ margin: '0.4em 0 0.2em', fontSize: '1em' }}>{children}</h4>,
                        hr: () => <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.1)', margin: '0.5em 0' }} />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
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

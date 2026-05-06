import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiLogOut, FiMapPin, FiMessageCircle } from 'react-icons/fi';

export default function Navbar() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  if (!usuario) return null;

  return (
    <nav className="navbar">
      <Link to="/dashboard" className="navbar-brand">
        <img src="/logo-easytrip.png" alt="EasyTrip" className="navbar-logo" />
      </Link>
      <div className="navbar-links">
        <Link to="/dashboard" className="navbar-link"><FiMapPin size={16} /> Viagens</Link>
        <Link to="/chat" className="navbar-link"><FiMessageCircle size={16} /> Chat IA</Link>
      </div>
      <div className="navbar-user">
        <span>Olá, {usuario.nome}</span>
        <button onClick={handleLogout} className="btn-logout" title="Sair">
          <FiLogOut size={18} />
        </button>
      </div>
    </nav>
  );
}

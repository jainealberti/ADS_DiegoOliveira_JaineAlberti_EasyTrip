import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RotaPrivada({ children }) {
  const { usuario, carregando } = useAuth();

  if (carregando) {
    return <div className="loading-page"><div className="spinner" /></div>;
  }

  if (!usuario) {
    return <Navigate to="/login" />;
  }

  return children;
}

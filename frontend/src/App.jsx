import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RotaPrivada from './components/RotaPrivada';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import Dashboard from './pages/Dashboard';
import NovaViagem from './pages/NovaViagem';
import DetalhesViagem from './pages/DetalhesViagem';
import DetalhesRoteiro from './pages/DetalhesRoteiro';
import Custos from './pages/Custos';
import ChatIA from './pages/ChatIA';

function AppLayout() {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <>
      {!isLanding && <Navbar />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/dashboard" element={<RotaPrivada><Dashboard /></RotaPrivada>} />
        <Route path="/viagens/nova" element={<RotaPrivada><NovaViagem /></RotaPrivada>} />
        <Route path="/viagens/:id" element={<RotaPrivada><DetalhesViagem /></RotaPrivada>} />
        <Route path="/viagens/:id/custos" element={<RotaPrivada><Custos /></RotaPrivada>} />
        <Route path="/roteiros/:id" element={<RotaPrivada><DetalhesRoteiro /></RotaPrivada>} />
        <Route path="/chat" element={<RotaPrivada><ChatIA /></RotaPrivada>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  );
}

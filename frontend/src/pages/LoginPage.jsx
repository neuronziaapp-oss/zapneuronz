import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from '../components/auth/LoginForm';

const LoginPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading, iframeMode } = useAuth();

  // Redirecionar se já estiver autenticado (exceto em modo iframe)
  useEffect(() => {
    if (!loading && isAuthenticated && !iframeMode) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, loading, iframeMode, navigate]);

  // Mostrar loading se ainda estiver verificando (exceto em modo iframe)
  if (loading && !iframeMode) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  return <LoginForm />;
};

export default LoginPage;

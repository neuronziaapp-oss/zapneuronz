import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Loading from './common/Loading';

const ProtectedRoute = ({ children }) => {
  const { user, isAuthenticated, loading, iframeMode } = useAuth();

  console.log('🛡️ ProtectedRoute - Estado atual:')
  console.log('🔍 loading:', loading)
  console.log('🔍 isAuthenticated:', isAuthenticated)
  console.log('🔍 iframeMode:', iframeMode)
  console.log('🔍 user:', !!user)

  // Detectar se estamos em iframe mode pela URL (fallback)
  const isIframeByUrl = window.location.search.includes('iframe=true')
  console.log('🔍 URL atual:', window.location.href)
  console.log('🔍 Query string:', window.location.search)
  console.log('🔍 isIframeByUrl:', isIframeByUrl)
  
  // Mostrar loading apenas se não estivermos em iframe mode
  if (loading && !iframeMode && !isIframeByUrl) {
    console.log('⏳ Mostrando loading...')
    return (
      <Loading 
        fullScreen 
        size="lg" 
        text="Verificando autenticação..." 
      />
    );
  }

  // Se estiver em modo iframe ou URL contém iframe=true, permitir acesso
  if (iframeMode || isIframeByUrl) {
    console.log('🖼️ Modo iframe detectado, permitindo acesso')
    return children;
  }

  // Redirecionar para login se não estiver autenticado
  if (!isAuthenticated || !user) {
    console.log('❌ Não autenticado, redirecionando para login')
    return <Navigate to="/login" replace />;
  }

  // Renderizar componente protegido
  console.log('✅ Usuário autenticado, renderizando conteúdo')
  return children;
};

export default ProtectedRoute;

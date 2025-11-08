import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { useSocket } from '../contexts/SocketContext';
import Sidebar from '../components/chat/Sidebar';
import ChatArea from '../components/chat/ChatArea';
import InstanceModal from '../components/chat/InstanceModal';
import Loading from '../components/common/Loading';

const DashboardPage = () => {
  const appContext = useApp();
  const { isConnected } = useSocket();
  const [showInstanceModal, setShowInstanceModal] = useState(false);

  // Extrair state e dispatch com fallback  
  const state = appContext?.state;
  const dispatch = appContext?.dispatch;

  useEffect(() => {
    // Verificar se há instância ativa - só mostrar modal se não há instâncias disponíveis
    if (state && !state.currentInstance && !state.instanceLoading && state.instances.length === 0) {
      console.log('Não há instâncias disponíveis, abrindo modal')
      setShowInstanceModal(true);
    } else if (state?.currentInstance) {
      console.log('Instância ativa encontrada:', state.currentInstance.name)
      setShowInstanceModal(false);
    }
  }, [state?.currentInstance, state?.instanceLoading, state?.instances]);

  // Debug: verificar se o context está sendo fornecido corretamente
  if (!appContext) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Erro de Contexto</h2>
          <p className="text-gray-600">AppContext não está disponível</p>
        </div>
      </div>
    );
  }

  // Debug: verificar se state existe
  if (!state) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Erro de Estado</h2>
          <p className="text-gray-600">State não está definido no AppContext</p>
        </div>
      </div>
    );
  }

  // Loading inicial
  if (state.instanceLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <Loading 
          size="lg" 
          text="Carregando suas instâncias..." 
        />
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gradient-to-br from-slate-50 to-white overflow-hidden">
      {/* Sidebar - Responsivo */}
      <div className="hidden md:flex w-80 lg:w-96 bg-white/95 backdrop-blur-sm border-r border-slate-200/60 shadow-lg flex-col">
        <Sidebar />
      </div>

      {/* Mobile Sidebar - Overlay */}
      <div className="md:hidden fixed inset-y-0 left-0 z-50 w-80 bg-white border-r border-slate-200 transform -translate-x-full transition-transform duration-300 ease-in-out">
        <Sidebar />
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <ChatArea />
      </div>

      {/* Status de conexão */}
      {!isConnected && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-xl shadow-lg z-50 border border-red-400/20">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-300 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Desconectado</span>
          </div>
        </div>
      )}

      {/* Modal de Instância */}
      <InstanceModal 
        isOpen={showInstanceModal}
        onClose={() => setShowInstanceModal(false)}
      />
    </div>
  );
};

export default DashboardPage;

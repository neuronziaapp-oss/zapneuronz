import React, { useEffect, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import apiService from '../../services/api';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

const ChatArea = () => {
  const { state, fetchQRCode, connectInstance, checkInstanceStatus, loadInstances, recreateInstance } = useApp();
  const statusCheckIntervalRef = useRef(null);

  // Polling para verificar status quando instância não está conectada
  useEffect(() => {
    const instance = state?.currentInstance;
    
    if (instance && instance.status !== 'connected') {
      // Iniciar polling a cada 2 segundos (mais responsivo)
      statusCheckIntervalRef.current = setInterval(async () => {
        const status = await checkInstanceStatus(instance.id);
        if (status === 'connected') {
          // Parar polling quando conectar
          clearInterval(statusCheckIntervalRef.current);
          statusCheckIntervalRef.current = null;
        }
      }, 2000);
    } else {
      // Limpar polling se já conectado ou sem instância
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
        statusCheckIntervalRef.current = null;
      }
    }

    // Cleanup ao desmontar ou mudar instância
    return () => {
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
        statusCheckIntervalRef.current = null;
      }
    };
  }, [state?.currentInstance, checkInstanceStatus]);

  if (!state?.currentChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          {/* Ícone do WhatsApp */}
          <div className="mx-auto w-64 h-64 mb-8 opacity-10">
            <svg viewBox="0 0 303 182" className="w-full h-full">
              <defs>
                <linearGradient x1="50%" y1="0%" x2="50%" y2="100%" id="a">
                  <stop stopColor="#F0F0F0" offset="0%" />
                  <stop stopColor="#E0E0E0" offset="100%" />
                </linearGradient>
              </defs>
              <g fill="none" fillRule="evenodd">
                <rect fill="url(#a)" width="303" height="182" rx="2" />
                <circle fill="#FFF" cx="154" cy="91" r="43" />
                <path 
                  d="M154 48c-23.8 0-43 19.2-43 43s19.2 43 43 43 43-19.2 43-43-19.2-43-43-43zm0 78c-19.3 0-35-15.7-35-35s15.7-35 35-35 35 15.7 35 35-15.7 35-35 35z" 
                  fill="#D9D9D9"
                />
              </g>
            </svg>
          </div>

          <h2 className="text-2xl font-light text-gray-600 mb-4">
            Neurons Web Chat
          </h2>
          <p className="text-gray-500 mb-6 leading-relaxed">
            Envie e receba mensagens sem manter seu celular conectado.
            <br />
            Use o Neurons Web Chat em até 4 dispositivos conectados e 1 celular ao mesmo tempo.
          </p>

          {!state?.currentInstance ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center">
                <svg className="w-6 h-6 text-yellow-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-yellow-800 text-sm">
                  {state?.instances?.length > 0 
                    ? `${state.instances.length} instância(s) encontrada(s), mas nenhuma selecionada` 
                    : 'Configure uma instância do WhatsApp para começar'}
                </p>
              </div>
              {state?.instances?.length > 0 && (
                <button
                  onClick={() => loadInstances()}
                  className="w-full px-3 py-2 text-sm bg-yellow-100 border border-yellow-300 rounded-md text-yellow-800 hover:bg-yellow-200"
                >
                  Recarregar Instâncias
                </button>
              )}
            </div>
          ) : state?.currentInstance?.status !== 'connected' ? (
            <div className="space-y-4">
              {/* Verificar se a instância está órfã */}
              {state?.currentInstance?.status === 'error' && state?.currentInstance?.orphaned ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <svg className="w-6 h-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <p className="text-red-800 text-sm font-medium">Instância não encontrada no servidor</p>
                      <p className="text-red-700 text-xs mt-1">A instância foi removida ou não existe mais no Evolution API.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => recreateInstance(state.currentInstance.id)}
                      className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Recriar Instância
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  {state?.currentInstance?.qrCode ? (
                <div className="flex flex-col items-center">
                        {(() => {
                          const qr = state.currentInstance.qrCode
                          const src = qr?.startsWith('data:image')
                            ? qr
                            : `data:image/png;base64,${qr}`
                          return (
                            <img
                              alt="QR Code"
                              className="w-60 h-60 rounded bg-white p-2 shadow"
                              src={src}
                            />
                          )
                        })()}
                  <p className="text-sm text-gray-600 mt-2">
                    Abra o WhatsApp no celular → Dispositivos conectados → Conectar um dispositivo
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => fetchQRCode(state.currentInstance.id)}
                      className="px-3 py-1.5 text-sm border border-blue-300 rounded-md text-blue-700 hover:bg-blue-100"
                    >
                      Atualizar QR
                    </button>
                    <button
                      onClick={() => connectInstance(state.currentInstance.id)}
                      className="px-3 py-1.5 text-sm border border-blue-300 rounded-md text-blue-700 hover:bg-blue-100"
                    >
                      Tentar Conectar
                    </button>
                    <button
                      onClick={async () => {
                        console.log('Botão Verificar Status clicado')
                        if (state.currentInstance?.id) {
                          await checkInstanceStatus(state.currentInstance.id)
                        } else {
                          console.error('Nenhuma instância atual encontrada')
                        }
                      }}
                      className="px-3 py-1.5 text-sm border border-green-300 rounded-md text-green-700 hover:bg-green-100 transition-colors"
                    >
                      Verificar Status
                    </button>
                  </div>
                </div>
                  ) : (
                    <div className="text-sm text-blue-800">Aguardando geração do QR Code...</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-6 h-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-green-800 text-sm">
                  Selecione uma conversa para começar a trocar mensagens
                </p>
              </div>
            </div>
          )}

          {/* Informações sobre recursos */}
          <div className="mt-8 text-left">
            <h3 className="text-lg font-medium text-gray-700 mb-4">
              Recursos disponíveis:
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Mensagens de texto em tempo real
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Envio de imagens, vídeos e documentos
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Mensagens de voz e áudio
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Grupos e conversas individuais
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Status de entrega e leitura
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Notificações em tempo real
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen">
      {/* Header do Chat */}
      <ChatHeader />
      
      {/* Lista de Mensagens */}
      <div className="flex-1 overflow-hidden">
        <MessageList />
      </div>
      
      {/* Input de Mensagem */}
      <MessageInput />
    </div>
  );
};

export default ChatArea;

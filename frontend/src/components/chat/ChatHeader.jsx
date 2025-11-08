import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import Avatar from '../common/Avatar';
import Modal from '../common/Modal';
import { formatRelativeTime } from '../../utils/dateUtils';
import { formatPhone } from '../../utils/helpers';

const ChatHeader = () => {
  const { state, dispatch } = useApp();
  const [showChatInfo, setShowChatInfo] = useState(false);
  const { currentChat: activeChat } = state;

  if (!activeChat) return null;

  const getPresenceText = () => {
    if (!activeChat.presence || activeChat.presence === 'offline') {
      return activeChat.lastSeen 
        ? `visto por último ${formatRelativeTime(new Date(activeChat.lastSeen))}`
        : 'offline';
    }
    
    switch (activeChat.presence) {
      case 'online':
        return 'online';
      case 'typing':
        return 'digitando...';
      case 'recording':
        return 'gravando áudio...';
      default:
        return '';
    }
  };

  const handleBackClick = () => {
    dispatch({ type: 'SET_ACTIVE_CHAT', payload: null });
  };

  const handleVideoCall = () => {
    // TODO: Implementar chamada de vídeo
    console.log('Iniciando chamada de vídeo com:', activeChat.phone);
  };

  const handleVoiceCall = () => {
    // TODO: Implementar chamada de voz  
    console.log('Iniciando chamada de voz com:', activeChat.phone);
  };

  const handleStart = () => {
    console.log('Iniciando controle do chat para:', activeChat.id);
  };

  const handlePause = () => {
    console.log('Pausando controle do chat para:', activeChat.id);
  };

  const handleStop = () => {
    console.log('Parando controle do chat para:', activeChat.id);
  };

  const handleSearchInChat = () => {
    // TODO: Implementar busca no chat
    console.log('Buscar no chat:', activeChat.id);
  };

  const handleChatOptions = () => {
    setShowChatInfo(true);
  };

  return (
    <>
      <div className="bg-gray-100 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Info do Chat */}
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {/* Botão Voltar (mobile) */}
            <button
              onClick={handleBackClick}
              className="md:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Avatar e Info */}
            <div 
              className="flex items-center space-x-3 cursor-pointer hover:bg-gray-200 rounded-md p-2 -m-2 transition-colors"
              onClick={() => setShowChatInfo(true)}
            >
              <Avatar
                src={activeChat.avatar}
                name={activeChat.name}
                size="md"
                status={activeChat.presence}
                isGroup={activeChat.isGroup}
              />

              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-gray-900 truncate">
                  {activeChat.name || formatPhone(activeChat.phone)}
                </h3>
                {/* <p className="text-sm text-gray-500 truncate">
                  {activeChat.isGroup 
                    ? `${activeChat.participants?.length || 0} participantes`
                    : getPresenceText()
                  }
                </p> */}
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center space-x-2">
            {/* <button
              onClick={handleStart}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-100 hover:text-gray-800 transition-colors"
              title="Iniciar controles"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M4.5 5.653c0-.88.95-1.423 1.714-.985l12.06 6.847a1.125 1.125 0 010 1.97l-12.06 6.848A1.125 1.125 0 014.5 18.348V5.652z" clipRule="evenodd" />
              </svg>
              <span>Iniciar</span>
            </button>
            <button
              onClick={handlePause}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-100 hover:text-gray-800 transition-colors"
              title="Pausar controles"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M6.75 5.625c-.621 0-1.125.504-1.125 1.125v10.5c0 .621.504 1.125 1.125 1.125h1.5c.621 0 1.125-.504 1.125-1.125v-10.5c0-.621-.504-1.125-1.125-1.125h-1.5zm6 0c-.621 0-1.125.504-1.125 1.125v10.5c0 .621.504 1.125 1.125 1.125h1.5c.621 0 1.125-.504 1.125-1.125v-10.5c0-.621-.504-1.125-1.125-1.125h-1.5z" clipRule="evenodd" />
              </svg>
              <span>Pausar</span>
            </button>
            <button
              onClick={handleStop}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-100 hover:text-gray-800 transition-colors"
              title="Parar controles"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="1.5" />
              </svg>
              <span>Parar</span>
            </button> */}
            {/* Chamada de Vídeo */}
            {/* <button
              onClick={handleVideoCall}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
              title="Chamada de vídeo"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button> */}

            {/* Chamada de Voz */}
            {/* <button
              onClick={handleVoiceCall}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
              title="Chamada de voz"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </button> */}

            {/* Buscar */}
            {/* <button
              onClick={handleSearchInChat}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
              title="Buscar no chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button> */}

            {/* Menu de Opções */}
            <button
              onClick={handleChatOptions}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
              title="Opções do chat"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Informações do Chat */}
      <Modal
        isOpen={showChatInfo}
        onClose={() => setShowChatInfo(false)}
        title={activeChat.isGroup ? 'Informações do Grupo' : 'Informações do Contato'}
        size="md"
      >
        <div className="space-y-6">
          {/* Avatar e Nome */}
          <div className="text-center">
            <Avatar
              src={activeChat.avatar}
              name={activeChat.name}
              size="2xl"
              isGroup={activeChat.isGroup}
              className="mx-auto mb-4"
            />
            <h3 className="text-xl font-semibold text-gray-900">
              {activeChat.name || formatPhone(activeChat.phone)}
            </h3>
            {!activeChat.isGroup && (
              <p className="text-gray-500 mt-1">
                {formatPhone(activeChat.phone)}
              </p>
            )}
          </div>

          {/* Informações */}
          <div className="space-y-4">
            {activeChat.isGroup ? (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-700">Descrição</label>
                  <p className="mt-1 text-sm text-gray-600">
                    {activeChat.description || 'Nenhuma descrição'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Participantes</label>
                  <p className="mt-1 text-sm text-gray-600">
                    {activeChat.participants?.length || 0} membros
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Criado em</label>
                  <p className="mt-1 text-sm text-gray-600">
                    {activeChat.createdAt 
                      ? new Date(activeChat.createdAt).toLocaleDateString('pt-BR')
                      : 'Data não disponível'
                    }
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <p className="mt-1 text-sm text-gray-600">
                    {activeChat.status || 'Nenhum status'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Última vez visto</label>
                  <p className="mt-1 text-sm text-gray-600">
                    {activeChat.lastSeen
                      ? formatRelativeTime(new Date(activeChat.lastSeen))
                      : 'Nunca visto online'
                    }
                  </p>
                </div> */}
              </>
            )}
          </div>

          {/* Ações */}
          {/* <div className="border-t pt-4 space-y-2">
            <button className="w-full text-left p-3 hover:bg-gray-50 rounded-md transition-colors">
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
                <span className="text-sm">Silenciar notificações</span>
              </div>
            </button>
            
            <button className="w-full text-left p-3 hover:bg-gray-50 rounded-md transition-colors">
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="text-sm">Limpar conversa</span>
              </div>
            </button>
            
            <button className="w-full text-left p-3 hover:bg-red-50 rounded-md transition-colors text-red-600">
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                </svg>
                <span className="text-sm">Bloquear contato</span>
              </div>
            </button>
          </div> */}
        </div>
      </Modal>
    </>
  );
};

export default ChatHeader;

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../contexts/AppContext';
import { useSocket } from '../../contexts/SocketContext';
import Avatar from '../common/Avatar';
import Loading, { LoadingList } from '../common/Loading';
import ContactModal from './ContactModal';
import InstanceManager from './InstanceManager';
import NewChatView from './NewChatView';
import { formatRelativeTime, isToday, isYesterday } from '../../utils/dateUtils';
import { truncateText } from '../../utils/helpers';
import { MESSAGE_TYPES } from '../../utils/constants';

const MEDIA_LABELS = {
  [MESSAGE_TYPES.IMAGE]: '📷 Imagem',
  [MESSAGE_TYPES.VIDEO]: '🎥 Vídeo',
  [MESSAGE_TYPES.AUDIO]: '🎵 Áudio',
  [MESSAGE_TYPES.DOCUMENT]: '📎 Documento',
  [MESSAGE_TYPES.LOCATION]: '📍 Localização',
  [MESSAGE_TYPES.CONTACT]: '👤 Contato',
  [MESSAGE_TYPES.STICKER]: '😄 Figurinha'
};

const normalizeMessageType = (type) => {
  if (!type) return MESSAGE_TYPES.TEXT;

  const normalized = type.toLowerCase();

  if (normalized.includes('image')) return MESSAGE_TYPES.IMAGE;
  if (normalized.includes('video')) return MESSAGE_TYPES.VIDEO;
  if (normalized.includes('audio') || normalized.includes('ptt')) return MESSAGE_TYPES.AUDIO;
  if (normalized.includes('document')) return MESSAGE_TYPES.DOCUMENT;
  if (normalized.includes('sticker')) return MESSAGE_TYPES.STICKER;
  if (normalized.includes('location')) return MESSAGE_TYPES.LOCATION;
  if (normalized.includes('contact')) return MESSAGE_TYPES.CONTACT;
  if (normalized.includes('text') || normalized.includes('conversation')) return MESSAGE_TYPES.TEXT;

  return MESSAGE_TYPES.TEXT;
};

const shouldDisplayContent = (content, rawType) => {
  if (typeof content !== 'string') return false;

  const trimmed = content.trim();
  if (!trimmed) return false;

  const normalizedContent = trimmed.toLowerCase();
  const normalizedType = (rawType || '').toLowerCase();

  if (!normalizedType) return true;
  if (normalizedContent === normalizedType) return false;

  if (normalizedType.endsWith('message')) {
    const baseType = normalizedType.replace('message', '');
    if (normalizedContent === baseType || normalizedContent === `${baseType}message`) {
      return false;
    }
  }

  if (normalizedContent === `${normalizedType}message`) {
    return false;
  }

  return true;
};

const Sidebar = () => {
  const appContext = useApp();
  const { state, dispatch, loadChats, searchMessages, selectChat } = appContext;
  const { socket } = useSocket();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showInstanceManager, setShowInstanceManager] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    // Carregar chats ao montar o componente
    if (state.currentInstance) {
      // Garantir que o ID da instância seja enviado para evitar chamadas /undefined/chats
      loadChats(state.currentInstance.id, {
        showLoader: state.chats.length === 0
      });
    }
  }, [state.currentInstance]);
  
  // Configurar recarga automática de chats a cada 30 segundos
  useEffect(() => {
    let intervalId;
    
    if (state.currentInstance?.id) {
      // Recarregar a lista de chats a cada 30 segundos para garantir dados atualizados
      intervalId = setInterval(() => {
        console.log('🔄 Recarregando lista de chats automaticamente...');
        loadChats(state.currentInstance.id, { showLoader: false });
      }, 30000); // 30 segundos
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [state.currentInstance?.id]);

  useEffect(() => {
    // Buscar chats quando o termo de busca mudar
    const timeoutId = setTimeout(async () => {
      if (searchTerm.trim()) {
        setIsSearching(true);
        try {
          await searchMessages(searchTerm);
        } finally {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleChatSelect = (chat) => {
    console.log('🔍 Sidebar - handleChatSelect chamado com:', chat);
    selectChat(chat);
  };

  const getLastMessagePreview = (chat) => {
    if (!chat.lastMessage) return 'Nenhuma mensagem';

    // chat.lastMessage pode vir como objeto direto ou string JSON
    let messageObj;
    try {
      messageObj = typeof chat.lastMessage === 'string' 
        ? JSON.parse(chat.lastMessage) 
        : chat.lastMessage;
    } catch (error) {
      console.error('Erro ao fazer parse do lastMessage:', error);
      return 'Mensagem inválida';
    }

    const { content, type, fromMe } = messageObj;
    const prefix = fromMe ? 'Você: ' : '';
    const normalizedType = normalizeMessageType(type);

    if (normalizedType === MESSAGE_TYPES.TEXT) {
      if (typeof content === 'string' && content.trim()) {
        return prefix + truncateText(content, 50);
      }
      return prefix + 'Mensagem de texto';
    }

    if (shouldDisplayContent(content, type)) {
      return prefix + truncateText(content, 50);
    }

    const friendlyLabel = MEDIA_LABELS[normalizedType] || 'Mensagem';
    return prefix + friendlyLabel;
  };

  const getLastMessageTime = (chat) => {
    if (!chat.lastMessage) return '';
    
    // Usar lastMessageTime direto do chat se disponível (formato da Evolution API)
    if (chat.lastMessageTime) {
      const date = new Date(chat.lastMessageTime);
      if (isValid(date)) {
        return formatMessageDate(date);
      }
    }
    
    // Fallback para o formato anterior
    let messageObj;
    try {
      messageObj = typeof chat.lastMessage === 'string' 
        ? JSON.parse(chat.lastMessage) 
        : chat.lastMessage;
    } catch (error) {
      return '';
    }

    if (!messageObj?.timestamp) return '';
    
    const date = new Date(messageObj.timestamp);
    
    return formatMessageDate(date);
  };
  
  // Função auxiliar para verificar se a data é válida
  const isValid = (date) => {
    return date instanceof Date && !isNaN(date);
  };
  
  // Função auxiliar para formatar a data da mensagem
  const formatMessageDate = (date) => {
    
    if (isToday(date)) {
      return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    if (isYesterday(date)) {
      return 'Ontem';
    }
    
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit'
    });
  };

  const handleCheckWebhook = async () => {
    if (!state.currentInstance) return;

    console.log('🔍 Verificando webhook para instância:', state.currentInstance.id);
    console.log('📋 Estado da instância atual:', state.currentInstance);

    try {
      const result = await appContext.checkWebhook(state.currentInstance.id);
      
      const { webhook } = result;
      const status = webhook.needsReconfig ? 
        (webhook.reconfigured ? 'Webhook reconfigurado com sucesso!' : 'Falha ao reconfigurar webhook') :
        'Webhook está configurado corretamente';
      
      console.log('🔍 Status do webhook:', status);
      console.log('📋 Detalhes:', webhook);
      
      // Mostrar notificação baseada no resultado
      if (webhook.needsReconfig) {
        if (webhook.reconfigured) {
          appContext.showNotification('success', 'Webhook reconfigurado com sucesso');
        } else {
          appContext.showNotification('error', 'Falha ao reconfigurar webhook');
        }
      } else {
        appContext.showNotification('info', 'Webhook já está configurado corretamente');
      }
    } catch (error) {
      console.error('❌ Erro ao verificar webhook:', error);
      appContext.showNotification('error', 'Erro ao verificar webhook');
    }
  };

  const filteredChats = searchTerm.trim() 
    ? state.chats.filter(chat => 
        chat.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chat.phone?.includes(searchTerm)
      )
    : state.chats;

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* New Chat View */}
      <NewChatView 
        isOpen={showNewChat}
        onClose={() => setShowNewChat(false)}
      />

      {/* Main Content */}
      <motion.div
        className="flex flex-col h-full"
        animate={{ 
          x: showNewChat ? '-100%' : '0%'
        }}
        transition={{
          type: 'tween',
          ease: 'easeOut',
          duration: 0.3
        }}
        style={{ pointerEvents: showNewChat ? 'none' : 'auto' }}
      >
        {/* Header */}
      <div className="bg-gray-100 border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Avatar 
              src={state.currentInstance?.profilePictureUrl || state.user?.avatar}
              name={state.currentInstance?.profileName || state.user?.name || 'Usuário'}
              size="md"
              //status={state.user?.status}
            />
            <div>
              <h2 className="font-semibold text-gray-900">
                {state.currentInstance?.profileName || state.user?.name || 'Usuário'}
              </h2>
              <p className="text-sm text-gray-500">
                {state.currentInstance?.status === 'connected' && (state.currentInstance?.ownerJid || state.currentInstance?.phone)
                  ? `Online • ${(state.currentInstance?.ownerJid?.replace('@s.whatsapp.net', '') || state.currentInstance?.phone || '').substring(0, 15)}${(state.currentInstance?.ownerJid?.replace('@s.whatsapp.net', '') || state.currentInstance?.phone || '').length > 15 ? '...' : ''}`
                  : state.currentInstance?.status === 'connecting'
                  ? 'Conectando...'
                  : 'Desconectado'}
              </p>
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center space-x-2">
            <motion.button 
              onClick={() => setShowNewChat(true)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
              title="Novo chat"
              disabled={!state.currentInstance || state.currentInstance.status !== 'connected'}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </motion.button>

            <motion.button 
              onClick={() => appContext.syncChatsManual(state.currentInstance?.id)}
              disabled={!state.currentInstance || state.currentInstance.status !== 'connected' || state.syncingChats}
              className={`p-2 ${state.highlightSyncButton 
                ? 'bg-blue-100 text-blue-600 animate-pulse ring-2 ring-blue-400 scale-110' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'} 
                rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
              title={state.highlightSyncButton 
                ? "✨ Clique aqui para sincronizar suas conversas!" 
                : "Sincronizar chats"}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.svg 
                className={`w-5 h-5 ${state.highlightSyncButton ? 'text-blue-600' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                animate={{ 
                  rotate: state.syncingChats ? 360 : (state.highlightSyncButton ? [0, 15, -15, 0] : 0),
                  scale: state.highlightSyncButton && !state.syncingChats ? [1, 1.2, 1] : 1 
                }}
                transition={{ 
                  rotate: { duration: state.syncingChats ? 2 : 0.5, repeat: state.syncingChats ? Infinity : (state.highlightSyncButton ? 3 : 0) }, 
                  scale: { duration: 0.8, repeat: state.highlightSyncButton && !state.syncingChats ? Infinity : 0, repeatType: "reverse" },
                  ease: "easeInOut"
                }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </motion.svg>
            </motion.button>

            {/* <motion.button 
              onClick={() => handleCheckWebhook()}
              disabled={!state.currentInstance}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Verificar Webhook"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </motion.button> */}
            
            <button 
              onClick={() => setShowInstanceManager(true)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
              title="Gerenciar Instâncias"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
              </svg>
            </button>
            
            {/* <button 
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
              title="Menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button> */}
          </div>
        </div>

        {/* Busca */}
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Pesquisar conversas"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 text-sm"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {isSearching ? (
              <Loading size="xs" />
            ) : (
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Lista de Chats */}
      <div className="flex-1 overflow-y-auto">
        {state.chatLoading ? (
          <div className="p-4">
            <LoadingList count={8} showAvatar={true} />
          </div>
        ) : state.syncingChats ? (
          <div className="flex flex-col items-center justify-center h-full text-blue-600">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 mb-4"
            >
              <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </motion.div>
            <p className="text-lg font-medium">Sincronizando chats...</p>
            <p className="text-sm text-gray-600">Carregando histórico do WhatsApp</p>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            {searchTerm ? (
              <>
                <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-lg font-medium">Nenhum chat encontrado</p>
                <p className="text-sm">Tente buscar com outros termos</p>
              </>
            ) : (
              <>
                <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-lg font-medium">Nenhuma conversa ainda</p>
                <p className="text-sm">Comece uma conversa enviando uma mensagem</p>
              </>
            )}
          </div>
        ) : (
          <div>
            {filteredChats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => handleChatSelect(chat)}
                className={`
                  flex items-center p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 transition-colors
                  ${state.currentChat?.id === chat.id ? 'bg-green-50 border-l-4 border-l-green-500' : ''}
                `}
              >
                <Avatar
                  src={chat.avatar || chat.profilePicUrl}
                  name={chat.name || chat.pushName || (chat.remoteJid ? chat.remoteJid.split('@')[0] : '')}
                  size="md"
                  status={chat.presence}
                  isGroup={chat.isGroup || (chat.remoteJid && chat.remoteJid.endsWith('@g.us'))}
                  className="mr-3"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {chat.name || chat.pushName || chat.phone || (chat.remoteJid ? chat.remoteJid.split('@')[0] : 'Chat')}
                    </h3>
                    <span className="text-xs text-gray-500">
                      {getLastMessageTime(chat)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600 truncate flex-1">
                      {getLastMessagePreview(chat)}
                    </p>

                    <div className="flex items-center space-x-2 ml-2">
                      {/* Status da mensagem */}
                      {chat.lastMessage?.fromMe && (
                        <div className="flex-shrink-0">
                          {chat.lastMessage.status === 'sent' && (
                            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                          {chat.lastMessage.status === 'delivered' && (
                            <svg className="w-4 h-4 text-gray-400" viewBox="0 0 16 15" fill="currentColor">
                              <path d="M10.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514L3.289 10.8c.327.312.803.312 1.13 0l6.091-6.207a.366.366 0 0 0-.6-.277z"/>
                              <path d="M14.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.566 9.879a.32.32 0 0 1-.484.033L6.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514L7.289 10.8c.327.312.803.312 1.13 0l6.091-6.207a.366.366 0 0 0-.6-.277z"/>
                            </svg>
                          )}
                          {chat.lastMessage.status === 'read' && (
                            <svg className="w-4 h-4 text-blue-500" viewBox="0 0 16 15" fill="currentColor">
                              <path d="M10.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514L3.289 10.8c.327.312.803.312 1.13 0l6.091-6.207a.366.366 0 0 0-.6-.277z"/>
                              <path d="M14.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.566 9.879a.32.32 0 0 1-.484.033L6.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514L7.289 10.8c.327.312.803.312 1.13 0l6.091-6.207a.366.366 0 0 0-.6-.277z"/>
                            </svg>
                          )}
                        </div>
                      )}

                      {/* Mensagens não lidas */}
                      {chat.unreadCount > 0 && (
                        <div className="bg-green-600 text-white text-xs rounded-full min-w-5 h-5 flex items-center justify-center px-1">
                          {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                        </div>
                      )}

                      {/* Chat silenciado */}
                      {chat.isMuted && (
                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </motion.div>

      {/* Modal de Contatos */}
      <ContactModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
      />

      {/* Modal de Gerenciar Instâncias */}
      <InstanceManager
        isOpen={showInstanceManager}
        onClose={() => setShowInstanceManager(false)}
      />
    </div>
  );
};

export default Sidebar;

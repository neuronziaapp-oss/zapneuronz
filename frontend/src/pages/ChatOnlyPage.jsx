import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import MessageList from '../components/chat/MessageList';
import MessageInput from '../components/chat/MessageInput';
import Loading from '../components/common/Loading';

const ChatOnlyPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { state, loadInstances, setCurrentInstance, loadChats, setCurrentChat, loadMessages } = useApp();
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState(null);

  const instanceId = searchParams.get('instanceId');
  const chatId = searchParams.get('chatId');
  const phone = searchParams.get('phone');

  useEffect(() => {
    const initializeChat = async () => {
      try {
        setIsInitializing(true);
        setError(null);

        // Validar parâmetros obrigatórios
        if (!instanceId) {
          setError('Parâmetro instanceId é obrigatório');
          setIsInitializing(false);
          return;
        }

        if (!chatId && !phone) {
          setError('É necessário informar chatId ou phone');
          setIsInitializing(false);
          return;
        }

        // 1. Carregar instâncias se ainda não foram carregadas
        if (!state.instances || state.instances.length === 0) {
          await loadInstances();
        }

        // 2. Buscar e definir a instância atual
        const instance = state.instances.find(inst => inst.id === parseInt(instanceId));
        if (!instance) {
          setError(`Instância ${instanceId} não encontrada`);
          setIsInitializing(false);
          return;
        }

        if (!state.currentInstance || state.currentInstance.id !== instance.id) {
          await setCurrentInstance(instance);
        }

        // 3. Carregar chats da instância
        await loadChats(instance.id);

        // 4. Encontrar o chat específico
        let targetChat = null;
        
        if (chatId) {
          targetChat = state.chats.find(chat => 
            chat.id === parseInt(chatId) || 
            chat.chatId === chatId ||
            chat.remoteJid === chatId
          );
        } else if (phone) {
          // Buscar por número de telefone
          const normalizedPhone = phone.replace(/\D/g, '');
          targetChat = state.chats.find(chat => {
            const chatPhone = (chat.phone || chat.remoteJid || '').replace(/\D/g, '');
            return chatPhone.includes(normalizedPhone) || normalizedPhone.includes(chatPhone);
          });
        }

        if (!targetChat) {
          setError(`Chat não encontrado. ChatId: ${chatId || 'N/A'}, Phone: ${phone || 'N/A'}`);
          setIsInitializing(false);
          return;
        }

        // 5. Definir chat atual e carregar mensagens
        await setCurrentChat(targetChat);
        
        const chatIdentifier = targetChat.remoteJid || targetChat.chatId || targetChat.phone || targetChat.id;
        await loadMessages(instance.id, chatIdentifier, 1);

        setIsInitializing(false);
      } catch (err) {
        console.error('Erro ao inicializar chat:', err);
        setError(`Erro ao carregar chat: ${err.message}`);
        setIsInitializing(false);
      }
    };

    initializeChat();
  }, [instanceId, chatId, phone]);

  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loading text="Carregando chat..." className="scale-150" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-lg">
          <div className="mb-4 flex items-center text-red-600">
            <svg className="mr-2 h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-lg font-semibold">Erro ao Carregar Chat</h2>
          </div>
          <p className="mb-4 text-gray-700">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full rounded-md bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!state.currentChat) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <svg className="mx-auto mb-4 h-16 w-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-lg font-medium">Chat não encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header do Chat */}
      <div className="flex items-center border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <button
          onClick={() => navigate('/dashboard')}
          className="mr-3 rounded-md p-2 text-gray-600 transition-colors hover:bg-gray-100"
          title="Voltar ao Dashboard"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        
        <div className="flex items-center">
          <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
            {state.currentChat.isGroup ? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">
              {state.currentChat.name || state.currentChat.phone || 'Sem nome'}
            </h2>
            <p className="text-xs text-gray-500">
              {state.currentChat.isGroup ? 'Grupo' : state.currentChat.phone || ''}
            </p>
          </div>
        </div>
      </div>

      {/* Área de Mensagens */}
      <div className="flex-1 overflow-hidden">
        <MessageList />
      </div>

      {/* Input de Mensagem */}
      <MessageInput />
    </div>
  );
};

export default ChatOnlyPage;

import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import Modal from '../common/Modal';
import Avatar from '../common/Avatar';
import Loading from '../common/Loading';
import { formatPhone } from '../../utils/helpers';

const ContactModal = ({ isOpen, onClose }) => {
  const { state, loadContacts, selectChat } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && state.currentInstance) {
      setIsLoading(true);
      loadContacts(state.currentInstance.id).finally(() => {
        setIsLoading(false);
      });
    }
  }, [isOpen, state.currentInstance]);

  const filteredContacts = searchTerm.trim()
    ? state.contacts.filter(contact => 
        contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.pushName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.phone?.includes(searchTerm.replace(/\D/g, ''))
      )
    : state.contacts;

  const handleContactSelect = (contact) => {
    // Criar ou encontrar chat para este contato
    const existingChat = state.chats.find(chat => chat.phone === contact.phone || chat.remoteJid === contact.id);
    
    if (existingChat) {
      selectChat(existingChat);
    } else {
      // Criar novo chat
      const newChat = {
        id: contact.id || contact.phone,
        remoteJid: contact.id || `${contact.phone}@s.whatsapp.net`,
        name: contact.name || contact.pushName,
        phone: contact.phone,
        avatar: contact.profilePicture,
        unreadCount: 0,
        lastMessage: null,
        isGroup: false
      };
      selectChat(newChat);
    }
    
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Selecionar Contato">
      <div className="flex flex-col h-96 max-w-md">
        {/* Campo de busca */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar contatos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Lista de contatos */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loading size="md" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm.trim() ? 'Nenhum contato encontrado' : 'Nenhum contato disponível'}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id || contact.phone}
                  onClick={() => handleContactSelect(contact)}
                  className="flex items-center p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <Avatar
                    src={contact.profilePicture}
                    name={contact.name || contact.pushName}
                    size="md"
                    className="mr-3"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {contact.name || contact.pushName || 'Sem nome'}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {formatPhone(contact.phone)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ContactModal;
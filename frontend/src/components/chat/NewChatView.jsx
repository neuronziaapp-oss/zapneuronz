import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../contexts/AppContext';
import Avatar from '../common/Avatar';
import Loading from '../common/Loading';
import { formatPhone } from '../../utils/helpers';

const NewChatView = ({ isOpen, onClose }) => {
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

  useEffect(() => {
    // Reset search when closing
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const filteredContacts = searchTerm.trim()
    ? state.contacts.filter(contact => 
        contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.pushName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.phone?.includes(searchTerm.replace(/\D/g, ''))
      )
    : state.contacts;

  // Log para debug - verificar filteredContacts
  // console.log('🔍 filteredContacts:', {
  //   total: filteredContacts.length,
  //   firstFew: filteredContacts.slice(0, 3).map(c => ({ name: c.name, phone: c.phone }))
  // });

  const handleContactSelect = (contact) => {
    // Log detalhado do contato selecionado
    console.log('🔍 handleContactSelect chamado com:', {
      id: contact.id,
      name: contact.name,
      pushName: contact.pushName,
      phone: contact.phone,
      fullContact: contact
    });

    // Extrair identificador do contato (pode ser número de telefone ou ID interno)
    // A Evolution API pode retornar o número em diferentes campos ou um ID interno
    let contactIdentifier = contact.phone;
    
    // Se não tem phone, tentar extrair do id
    if (!contactIdentifier && contact.id) {
      if (contact.id.includes('@s.whatsapp.net')) {
        contactIdentifier = contact.id.split('@')[0];
      } else if (contact.id.includes('@g.us')) {
        // É um grupo, usar o id completo
        contactIdentifier = contact.id;
      } else {
        // Usar o ID direto (pode ser número ou hash interno)
        contactIdentifier = contact.id;
      }
    }
    
    // Se ainda não tem identificador, tentar outros campos
    if (!contactIdentifier) {
      contactIdentifier = contact.number || contact.remoteJid;
      if (contactIdentifier && contactIdentifier.includes('@')) {
        contactIdentifier = contactIdentifier.split('@')[0];
      }
    }
    
    if (!contactIdentifier) {
      console.error('❌ Não foi possível extrair identificador do contato:', contact);
      return;
    }
    
    console.log('✅ Identificador extraído:', contactIdentifier);

    // Criar ou encontrar chat para este contato
    const existingChat = state.chats.find(chat => 
      chat.phone === contactIdentifier || 
      chat.remoteJid === contact.id ||
      chat.Contact?.phone === contactIdentifier ||
      chat.id === contactIdentifier
    );
    
    if (existingChat) {
      console.log('✅ Chat existente encontrado:', existingChat.name);
      selectChat(existingChat);
    } else {
      // Criar novo chat - garantir formato correto do remoteJid
      const isGroup = contact.id?.includes('@g.us') || false;
      const remoteJid = isGroup ? contact.id : `${contactIdentifier}@s.whatsapp.net`;
      
      // Log para debug
      console.log(`🔍 Criando chat para contato: ${contact.name || contact.pushName}, identifier: ${contactIdentifier}, remoteJid: ${remoteJid}, isGroup: ${isGroup}`);
      
      const newChat = {
        id: contactIdentifier, // Usar identificador como id
        remoteJid: remoteJid,
        name: contact.name || contact.pushName || contactIdentifier,
        phone: contactIdentifier, // Manter compatibilidade
        avatar: contact.profilePicture || contact.profilePictureUrl,
        unreadCount: 0,
        lastMessage: null,
        isGroup: isGroup,
        Contact: {
          ...contact,
          phone: contactIdentifier // Garantir que o Contact também tem o identificador
        },
        chatId: contactIdentifier // Usar identificador como chatId também
      };
      selectChat(newChat);
    }
    
    onClose();
  };

  const slideVariants = {
    hidden: { 
      x: '100%'
    },
    visible: { 
      x: 0,
      transition: {
        type: 'tween',
        ease: 'easeOut',
        duration: 0.3
      }
    },
    exit: { 
      x: '100%',
      transition: {
        type: 'tween',
        ease: 'easeIn',
        duration: 0.25
      }
    }
  };

  const listVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.15,
        staggerChildren: 0.03
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        type: 'tween',
        ease: 'easeOut',
        duration: 0.2
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={slideVariants}
          className="absolute inset-0 bg-white z-50 flex flex-col"
        >
          {/* Header */}
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center space-x-3">
              <motion.button
                onClick={onClose}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </motion.button>
              <motion.h2 
                className="text-lg font-medium text-gray-900"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                Nova conversa
              </motion.h2>
            </div>
          </div>

          {/* Search */}
          <div className="p-4">
            <motion.div 
              className="relative"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <input
                type="text"
                placeholder="Pesquisar contatos"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 text-sm"
                autoFocus
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </motion.div>
          </div>

          {/* Contacts Section */}
          <div className="px-4 pb-2 border-b border-gray-100">
            <motion.p 
              className="text-sm text-gray-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Contatos
            </motion.p>
          </div>

          {/* Contacts List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-4">
                <Loading text="Carregando contatos..." />
              </div>
            ) : filteredContacts.length === 0 ? (
              <motion.div 
                className="flex flex-col items-center justify-center h-32 text-gray-500"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <svg className="w-12 h-12 mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p>Nenhum contato encontrado</p>
              </motion.div>
            ) : (
              <motion.div
                variants={listVariants}
                initial="hidden"
                animate="visible"
              >
                {filteredContacts.map((contact, index) => {
                  // Extrair número de telefone para exibição (só se for realmente um número)
                  let displayPhone = contact.phone;
                  if (!displayPhone && contact.id) {
                    if (contact.id.includes('@s.whatsapp.net')) {
                      const extracted = contact.id.split('@')[0];
                      // Só usar se for um número válido (pelo menos 8 dígitos)
                      if (/^\d{8,}$/.test(extracted)) {
                        displayPhone = extracted;
                      }
                    } else if (!contact.id.includes('@g.us') && /^\d{8,}$/.test(contact.id)) {
                      // Só usar o ID se for um número válido
                      displayPhone = contact.id;
                    }
                  }
                  
                  // Log para debug - verificar se cada contato é único
                  console.log(`🔍 Renderizando contato ${index}:`, {
                    name: contact.name || contact.pushName,
                    phone: displayPhone,
                    id: contact.id
                  });
                  
                  return (
                    <motion.div
                      key={contact.id || displayPhone || index}
                      variants={itemVariants}
                      className="flex items-center p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => {
                        console.log(`🔍 Clique no contato ${index}:`, contact.name || contact.pushName, displayPhone);
                        handleContactSelect(contact);
                      }}
                      whileHover={{ backgroundColor: '#f9fafb' }}
                      whileTap={{ scale: 0.99 }}
                    >
                  
                    <Avatar 
                      src={contact.profilePicture || contact.profilePicUrl}
                      name={contact.name || contact.pushName || displayPhone || 'Contato'}
                      size="md"
                      className="mr-3"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate text-sm">
                        {contact.name || contact.pushName || displayPhone || 'Sem nome'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {/* Só mostrar o número se for realmente um número de telefone válido */}
                        {displayPhone && /^\d+$/.test(displayPhone) ? 
                          formatPhone(displayPhone) : 
                          (contact.id?.includes('@g.us') ? 'Grupo' : 'Contato do WhatsApp')
                        }
                      </p>
                    </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NewChatView;
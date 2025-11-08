import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { useApp } from '../../contexts/AppContext';

const InstanceModal = ({ isOpen, onClose }) => {
  const appContext = useApp();
  const { createInstance, connectInstance } = appContext;
  const [instanceName, setInstanceName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!instanceName.trim()) {
      setError('Nome da instância é obrigatório');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Criar nova instância
      await createInstance(instanceName.trim());
      
      // Fechar modal
      onClose();
      setInstanceName('');
    } catch (error) {
      setError(error.message || 'Erro ao criar instância');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configurar WhatsApp"
      size="md"
      closeOnOverlayClick={false}
      showCloseButton={false}
    >
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Conectar ao WhatsApp
          </h3>
          <p className="text-sm text-gray-600">
            Para começar a usar o Neurons Web Chat, você precisa criar uma instância e conectar seu dispositivo.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <Input
            label="Nome da Instância"
            type="text"
            value={instanceName}
            onChange={(e) => setInstanceName(e.target.value)}
            placeholder="Ex: Meu WhatsApp"
            helperText="Escolha um nome para identificar esta conexão"
            disabled={isLoading}
            required
          />

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              Como funciona:
            </h4>
            <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
              <li>Clique em "Criar Instância" para gerar um código QR</li>
              <li>Abra o WhatsApp no seu celular</li>
              <li>Toque em Menu (⋮) &gt; Dispositivos conectados</li>
              <li>Toque em "Conectar um dispositivo"</li>
              <li>Escaneie o código QR que aparecerá na tela</li>
            </ol>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isLoading}
              disabled={isLoading || !instanceName.trim()}
              className="flex-1"
            >
              {isLoading ? 'Criando...' : 'Criar Instância'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default InstanceModal;

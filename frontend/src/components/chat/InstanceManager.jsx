import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { useApp } from '../../contexts/AppContext';
import notificationService from '../../services/notification';

const InstanceManager = ({ isOpen, onClose }) => {
  const { state, disconnectInstance, deleteInstance, selectInstance, recreateInstance, syncInstanceData } = useApp();
  const instances = Array.isArray(state?.instances) ? state.instances : [];
  const [loading, setLoading] = useState(null); // ID da instância que está carregando
  const [confirmDelete, setConfirmDelete] = useState(null); // ID da instância para confirmar delete

  // Função para sincronizar dados de todas as instâncias
  const handleSyncData = async () => {
    setLoading('sync');
    try {
      // Verificar se há instâncias conectadas
  const connectedInstances = instances.filter(instance => instance.status === 'connected');
      
      if (connectedInstances.length === 0) {
        // Se não houver instâncias conectadas, mostrar mensagem
        notificationService.showWarning('Não há instâncias conectadas para sincronizar. Conecte pelo menos uma instância primeiro.');
        return;
      }
      
      // Sincronizar apenas instâncias conectadas
      const promises = connectedInstances.map(instance => {
        // Mostrar notificação para cada instância
        notificationService.showInfo(
          `Iniciando sincronização da instância "${instance.name}"...`,
          3000
        );
        
        return syncInstanceData(instance.id).catch(error => {
          console.error(`Erro ao sincronizar instância ${instance.name}:`, error);
          return null; // Continue com outras instâncias
        });
      });
      
      await Promise.all(promises);
      
      // Mostrar notificação de conclusão
      if (connectedInstances.length > 0) {
        notificationService.showSuccess(
          `Sincronização de ${connectedInstances.length} ${connectedInstances.length === 1 ? 'instância' : 'instâncias'} iniciada com sucesso!`,
          5000
        );
      }
    } catch (error) {
      console.error('Erro ao sincronizar dados:', error);
      notificationService.showError('Erro ao iniciar sincronização');
    } finally {
      setLoading(null);
    }
  };

  const handleDisconnect = async (instanceId) => {
    setLoading(instanceId);
    try {
      await disconnectInstance(instanceId);
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (instanceId) => {
    setLoading(instanceId);
    try {
      await deleteInstance(instanceId);
      setConfirmDelete(null);
    } finally {
      setLoading(null);
    }
  };

  const handleRecreate = async (instanceId) => {
    setLoading(instanceId);
    try {
      await recreateInstance(instanceId);
    } finally {
      setLoading(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
        return 'text-green-600 bg-green-100';
      case 'connecting':
        return 'text-yellow-600 bg-yellow-100';
      case 'disconnected':
        return 'text-gray-600 bg-gray-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status, orphaned) => {
    if (orphaned) return 'Órfã';
    switch (status) {
      case 'connected':
        return 'Conectada';
      case 'connecting':
        return 'Conectando...';
      case 'disconnected':
        return 'Desconectada';
      case 'error':
        return 'Erro';
      default:
        return 'Desconhecido';
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Gerenciar Instâncias"
        size="lg"
        fullscreen
        bodyClassName="flex flex-col h-full"
      >
        <div className="text-sm text-gray-600">
          Gerencie suas instâncias do WhatsApp. Você pode desconectar, deletar ou recriar instâncias conforme necessário.
        </div>

        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          {instances.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-10 px-4">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-4h-2m-5 8V9.5" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm sm:text-base">
                Nenhuma instância encontrada
              </p>
            </div>
          ) : (
            <div className="space-y-3 pb-6">
              {instances.map((instance) => (
                <div
                  key={instance.id}
                  className={`border rounded-lg p-4 transition-colors ${
                    state.currentInstance?.id === instance.id ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                  }`}
                >
                  {/* Header row with avatar and basic info */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-shrink-0">
                      {instance.profilePictureUrl ? (
                        <img
                          src={instance.profilePictureUrl}
                          alt="Avatar"
                          className="w-12 h-12 rounded-full border-2 border-gray-200"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 text-base truncate">
                          {instance.name}
                        </h3>
                        {state.currentInstance?.id === instance.id && (
                          <span className="flex-shrink-0 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                            Ativa
                          </span>
                        )}
                      </div>
                      
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(instance.status)}`}>
                        {getStatusText(instance.status, instance.orphaned)}
                      </span>
                    </div>
                  </div>

                  {/* Instance details */}
                  <div className="space-y-2 mb-4">
                    {instance.profileName && (
                      <div className="text-sm text-gray-700 flex items-center gap-2">
                        <span className="text-gray-400">👤</span>
                        <span className="truncate">{instance.profileName}</span>
                      </div>
                    )}
                    
                    <div className="text-sm text-gray-500 flex items-center gap-2">
                      <span className="text-gray-400">📱</span>
                      <span className="truncate">
                        {instance.ownerJid ? 
                          instance.ownerJid.replace('@s.whatsapp.net', '') : 
                          instance.phone ? 
                            instance.phone : 
                            'Número não vinculado'
                        }
                      </span>
                    </div>
                    
                    {instance.orphaned && (
                      <div className="text-xs text-red-600 flex items-center gap-2">
                        <span>⚠️</span>
                        <span>Instância não encontrada no servidor</span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2">
                    {/* Selecionar instância */}
                    {state.currentInstance?.id !== instance.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => selectInstance(instance)}
                        disabled={loading === instance.id}
                      >
                        Selecionar
                      </Button>
                    )}

                    {/* Recriar se órfã */}
                    {instance.orphaned && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleRecreate(instance.id)}
                        loading={loading === instance.id}
                        disabled={loading === instance.id}
                      >
                        Recriar
                      </Button>
                    )}

                    {/* Desconectar se conectada */}
                    {/* {!instance.orphaned && (instance.status === 'connected' || instance.status === 'connecting') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(instance.id)}
                        loading={loading === instance.id}
                        disabled={loading === instance.id}
                      >
                        Desconectar
                      </Button>
                    )} */}

                    {/* Deletar */}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setConfirmDelete(instance.id)}
                      disabled={loading === instance.id}
                    >
                      Deletar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-4 border-t flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="outline"
            onClick={onClose}
            className="sm:w-auto"
            fullWidth
          >
            Fechar
          </Button>

          <Button
            variant="primary"
            onClick={handleSyncData}
            loading={loading === 'sync'}
            disabled={loading === 'sync'}
            fullWidth
          >
            Sincronizar Dados
          </Button>
        </div>
      </Modal>

      {/* Modal de confirmação de delete */}
      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Confirmar Exclusão"
        size="sm"
      >
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            Tem certeza que deseja deletar esta instância? Esta ação não pode ser desfeita e todos os dados relacionados (chats, mensagens, contatos) serão removidos.
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="text-sm text-red-800">
              <strong>⚠️ Atenção:</strong> A instância será completamente removida do sistema e do servidor Evolution API.
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(null)}
              disabled={loading === confirmDelete}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => handleDelete(confirmDelete)}
              loading={loading === confirmDelete}
              disabled={loading === confirmDelete}
            >
              Deletar Permanentemente
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default InstanceManager;
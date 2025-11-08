import React, { useState, useEffect } from 'react'
import { apiClient } from '../config/supabase'
import ChatArea from '../components/chat/ChatArea'
import Sidebar from '../components/chat/Sidebar'
import Loading from '../components/common/Loading'

const IframeApp = () => {
  const [instances, setInstances] = useState([])
  const [selectedInstance, setSelectedInstance] = useState(null)
  const [selectedChat, setSelectedChat] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [clientId, setClientId] = useState(null)
  const [authenticated, setAuthenticated] = useState(false)

  // Executar apenas uma vez na montagem
  useEffect(() => {
    initializeApp()
  }, [])

  const initializeApp = async () => {
    try {
      setLoading(true)
      
      // Extrair client_id e client_name da URL
      const urlParams = new URLSearchParams(window.location.search)
      const urlClientId = urlParams.get('client_id')
      const urlClientName = urlParams.get('client_name')
      
      console.log('🔑 Inicializando app iframe com client_id:', urlClientId)
      
      // Verificar se mudou o client_id - se sim, limpar token antigo
      const storedClientId = localStorage.getItem('current_client_id')
      if (storedClientId && storedClientId !== urlClientId) {
        console.log('⚠️ Client ID mudou! Limpando autenticação anterior...')
        console.log(`   De: ${storedClientId}`)
        console.log(`   Para: ${urlClientId}`)
        localStorage.removeItem('token')
        localStorage.removeItem('current_client_id')
      }
      
      if (urlClientId) {
        setClientId(urlClientId)
        localStorage.setItem('current_client_id', urlClientId)
        
        // Autenticar com client_id
        await authenticateWithClientId(urlClientId, urlClientName)
      } else {
        console.log('⚠️ Nenhum client_id fornecido, usando modo iframe padrão')
        // Limpar tokens quando não tem client_id
        localStorage.removeItem('token')
        localStorage.removeItem('current_client_id')
      }
      
      // Carregar instâncias após autenticação
      await loadInstances()
      setAuthenticated(true)
      
    } catch (err) {
      console.error('Erro ao inicializar app:', err)
      setError(err.message || 'Falha ao inicializar aplicação')
      setLoading(false)
    }
  }

  const authenticateWithClientId = async (clientId, clientName) => {
    try {
      console.log('🔐 Autenticando com client_id:', clientId)
      
      // Buscar API Key do ambiente
      const apiKey = process.env.REACT_APP_API_KEY
      
      if (!apiKey) {
        throw new Error('REACT_APP_API_KEY não configurada')
      }

      // Fazer request de autenticação
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/client/authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_name: clientName,
          api_key: apiKey
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Falha na autenticação')
      }

      const data = await response.json()
      
      // Salvar token no localStorage
      if (data.token) {
        localStorage.setItem('token', data.token)
        console.log('✅ Autenticação bem-sucedida para client_id:', clientId)
        console.log('👤 Usuário:', data.user.name)
      }
      
    } catch (error) {
      console.error('❌ Erro na autenticação:', error)
      throw error
    }
  }

  const loadInstances = async () => {
    try {
      setLoading(true)
      console.log('📋 Carregando instâncias...')
      console.log('🔑 Token JWT:', localStorage.getItem('token') ? 'Presente' : 'Ausente')
      console.log('🆔 Client ID:', clientId || 'Não definido')
      
      const data = await apiClient.get('/api/instances')
      console.log('✅ Instâncias carregadas:', data.instances?.length || 0)
      setInstances(data.instances || [])
      
      // Auto-selecionar primeira instância conectada
      const connectedInstance = data.instances?.find(i => i.status === 'connected')
      if (connectedInstance) {
        setSelectedInstance(connectedInstance)
      }
    } catch (err) {
      console.error('Erro ao carregar instâncias:', err)
      setError('Falha ao carregar instâncias do WhatsApp')
    } finally {
      setLoading(false)
    }
  }

  const handleInstanceSelect = (instance) => {
    setSelectedInstance(instance)
    setSelectedChat(null) // Reset selected chat when changing instance
  }

  const handleChatSelect = (chat) => {
    setSelectedChat(chat)
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loading message={clientId ? `Autenticando cliente: ${clientId}...` : "Carregando WhatsApp Web..."} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <div className="text-red-500 text-xl mb-4">⚠️ Erro de Conexão</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={initializeApp}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    )
  }

  if (!instances.length) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <div className="text-gray-500 text-xl mb-4">📱 Nenhuma Instância</div>
          <p className="text-gray-600">
            Nenhuma instância do WhatsApp foi encontrada. 
            Entre em contato com o administrador.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Header com seleção de instância (se múltiplas) */}
      {instances.length > 1 && (
        <div className="absolute top-0 left-0 right-0 bg-white border-b border-gray-200 z-10 p-2">
          <select
            value={selectedInstance?.id || ''}
            onChange={(e) => {
              const instance = instances.find(i => i.id === e.target.value)
              if (instance) handleInstanceSelect(instance)
            }}
            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecione uma instância</option>
            {instances.map(instance => (
              <option key={instance.id} value={instance.id}>
                {instance.name} - {instance.status === 'connected' ? '🟢 Conectado' : '🔴 Desconectado'}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={`flex w-full ${instances.length > 1 ? 'mt-16' : ''}`}>
        {/* Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          {selectedInstance ? (
            <Sidebar
              instanceId={selectedInstance.id}
              selectedChat={selectedChat}
              onChatSelect={handleChatSelect}
              isIframe={true}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-500">Selecione uma instância</p>
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedInstance && selectedChat ? (
            <ChatArea
              instanceId={selectedInstance.id}
              chat={selectedChat}
              isIframe={true}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="text-6xl mb-4">💬</div>
                <h2 className="text-xl font-semibold text-gray-700 mb-2">
                  WhatsApp Web
                </h2>
                <p className="text-gray-500">
                  {!selectedInstance 
                    ? 'Selecione uma instância para começar'
                    : 'Selecione uma conversa para começar a enviar mensagens'
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default IframeApp
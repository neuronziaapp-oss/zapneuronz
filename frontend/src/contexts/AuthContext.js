import React, { createContext, useContext, useReducer, useEffect } from 'react'
import apiService from '../services/api'
import notificationService from '../services/notification'

// Estado inicial
const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true,
  error: null,
  iframeMode: false
}

// Actions
const authActions = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  VERIFY_TOKEN_START: 'VERIFY_TOKEN_START',
  VERIFY_TOKEN_SUCCESS: 'VERIFY_TOKEN_SUCCESS',
  VERIFY_TOKEN_FAILURE: 'VERIFY_TOKEN_FAILURE',
  CLEAR_ERROR: 'CLEAR_ERROR',
  UPDATE_USER: 'UPDATE_USER',
  SET_IFRAME_MODE: 'SET_IFRAME_MODE'
}

// Reducer
function authReducer(state, action) {
  switch (action.type) {
    case authActions.LOGIN_START:
    case authActions.VERIFY_TOKEN_START:
      return {
        ...state,
        loading: true,
        error: null
      }

    case authActions.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        loading: false,
        error: null
      }

    case authActions.VERIFY_TOKEN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        loading: false,
        error: null
      }

    case authActions.LOGIN_FAILURE:
    case authActions.VERIFY_TOKEN_FAILURE:
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
        error: action.payload.error
      }

    case authActions.LOGOUT:
      return {
        ...initialState,
        loading: false
      }

    case authActions.CLEAR_ERROR:
      return {
        ...state,
        error: null
      }

    case authActions.UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload }
      }

    case authActions.SET_IFRAME_MODE:
      return {
        ...state,
        iframeMode: action.payload
      }

    default:
      return state
  }
}

// Contexto
const AuthContext = createContext()

// Provider
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Verificar token ao carregar a aplicação
  useEffect(() => {
    // console.log('🔍 Inicializando AuthContext...')
    // console.log('🔍 URL atual:', window.location.href)
    // console.log('🔍 Query string:', window.location.search)
    
    // Detectar se está em modo iframe
    const isIframe = window.self !== window.top || window.location.search.includes('iframe=true')
    // console.log('🔍 É iframe?', isIframe)
    // console.log('🔍 window.self !== window.top:', window.self !== window.top)
    // console.log('🔍 Contém iframe=true:', window.location.search.includes('iframe=true'))
    
    if (isIframe) {
      // console.log('🖼️ Modo iframe detectado, inicializando...')
      initializeIframeMode()
    } else {
      // console.log('🔐 Modo normal detectado, verificando token...')
      verifyToken()
    }
  }, [])

  // Inicializar modo iframe
  const initializeIframeMode = async () => {
    try {
      console.log('🖼️ Inicializando modo iframe...')
      
      // Primeiro marcar como iframe mode para evitar redirecionamentos
      dispatch({ type: authActions.SET_IFRAME_MODE, payload: true })
      
      dispatch({ type: authActions.VERIFY_TOKEN_START })
      
      // Extrair client_id da URL
      const urlParams = new URLSearchParams(window.location.search)
      const clientId = urlParams.get('client_id')
      const clientName = urlParams.get('client_name')
      
      console.log('🔑 Client ID detectado:', clientId)
      
      // Verificar se mudou o client_id - se sim, limpar token antigo
      const storedClientId = localStorage.getItem('current_client_id')
      if (storedClientId && storedClientId !== clientId) {
        console.log('⚠️ Client ID mudou! Limpando autenticação anterior...')
        console.log(`   De: ${storedClientId}`)
        console.log(`   Para: ${clientId}`)
        localStorage.removeItem('token')
        localStorage.removeItem('whatsapp_token')
        localStorage.removeItem('whatsapp_user')
        localStorage.removeItem('current_client_id')
      }
      
      let response
      
      if (clientId) {
        // Multi-tenancy: Autenticar com client_id
        console.log('🔐 Autenticando com client_id:', clientId)
        localStorage.setItem('current_client_id', clientId)
        
        const apiKey = process.env.REACT_APP_API_KEY
        
        const authResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/client/authenticate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            client_name: clientName,
            api_key: apiKey
          })
        })
        
        if (!authResponse.ok) {
          throw new Error('Falha na autenticação com client_id')
        }
        
        response = await authResponse.json()
        
        // Salvar token JWT específico do cliente
        localStorage.setItem('token', response.token)
        localStorage.setItem('whatsapp_token', response.token)
        console.log('✅ Autenticação multi-tenancy bem-sucedida!')
        console.log('👤 Usuário:', response.user.name, '- Client ID:', response.user.client_id)
        
      } else {
        // Modo iframe simples (sem client_id)
        console.log('🔑 Modo iframe simples (sem client_id)')
        localStorage.removeItem('current_client_id')
        localStorage.removeItem('token')
        
        response = await apiService.get('/api/auth/iframe-token')
        localStorage.setItem('whatsapp_token', response.token)
        console.log('✅ Token iframe obtido com sucesso')
      }

      // Salvar usuário no localStorage
      localStorage.setItem('whatsapp_user', JSON.stringify(response.user))

      dispatch({
        type: authActions.LOGIN_SUCCESS,
        payload: {
          user: response.user,
          token: response.token
        }
      })

      console.log('✅ Modo iframe inicializado com sucesso')

    } catch (error) {
      console.error('❌ Erro ao inicializar modo iframe:', error)
      
      // Mesmo com erro, manter iframe mode ativo para evitar redirecionamento
      dispatch({ type: authActions.SET_IFRAME_MODE, payload: true })
      
      dispatch({
        type: authActions.VERIFY_TOKEN_FAILURE,
        payload: { error: 'Erro ao obter token iframe' }
      })
    }
  }

  // Função de login
  const login = async credentials => {
    try {
      dispatch({ type: authActions.LOGIN_START })

      const response = await apiService.login(credentials)

      // Salvar token e usuário no localStorage
      localStorage.setItem('whatsapp_token', response.token)
      localStorage.setItem('whatsapp_user', JSON.stringify(response.user))

      dispatch({
        type: authActions.LOGIN_SUCCESS,
        payload: {
          user: response.user,
          token: response.token
        }
      })

      notificationService.showSuccess('Login realizado com sucesso!')

      return response
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Erro ao fazer login'

      dispatch({
        type: authActions.LOGIN_FAILURE,
        payload: { error: errorMessage }
      })

      notificationService.showError(errorMessage)
      throw error
    }
  }

  // Função de logout
  const logout = () => {
    // Remover dados do localStorage
    localStorage.removeItem('whatsapp_token')
    localStorage.removeItem('whatsapp_user')

    dispatch({ type: authActions.LOGOUT })

    notificationService.showInfo('Logout realizado com sucesso')
  }

  // Verificar token
  const verifyToken = async () => {
    const token = localStorage.getItem('whatsapp_token')
    const userStr = localStorage.getItem('whatsapp_user')

    if (!token || !userStr) {
      dispatch({
        type: authActions.VERIFY_TOKEN_FAILURE,
        payload: { error: 'Token não encontrado' }
      })
      return
    }

    try {
      dispatch({ type: authActions.VERIFY_TOKEN_START })

      // Verificar token com o backend
      const response = await apiService.verifyToken()

      dispatch({
        type: authActions.VERIFY_TOKEN_SUCCESS,
        payload: {
          user: response.user
        }
      })
    } catch (error) {
      // Token inválido ou expirado
      localStorage.removeItem('whatsapp_token')
      localStorage.removeItem('whatsapp_user')

      dispatch({
        type: authActions.VERIFY_TOKEN_FAILURE,
        payload: { error: 'Token inválido ou expirado' }
      })
    }
  }

  // Alterar senha
  const changePassword = async passwords => {
    try {
      await apiService.changePassword(passwords)
      notificationService.showSuccess('Senha alterada com sucesso!')
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || 'Erro ao alterar senha'
      notificationService.showError(errorMessage)
      throw error
    }
  }

  // Limpar erro
  const clearError = () => {
    dispatch({ type: authActions.CLEAR_ERROR })
  }

  // Atualizar dados do usuário
  const updateUser = userData => {
    const updatedUser = { ...state.user, ...userData }
    localStorage.setItem('whatsapp_user', JSON.stringify(updatedUser))

    dispatch({
      type: authActions.UPDATE_USER,
      payload: userData
    })
  }

  // Verificar permissões
  const hasPermission = permission => {
    if (!state.user) return false

    switch (permission) {
      case 'admin':
        return state.user.role === 'admin'
      case 'user_management':
        return state.user.role === 'admin'
      case 'instance_management':
        return true // Todos os usuários podem gerenciar suas instâncias
      case 'dashboard':
        return true // Todos os usuários têm acesso ao dashboard
      default:
        return false
    }
  }

  // Valor do contexto
  const value = {
    // Estado
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    loading: state.loading,
    iframeMode: state.iframeMode,
    error: state.error,

    // Actions
    login,
    logout,
    verifyToken,
    changePassword,
    clearError,
    updateUser,

    // Utilitários
    hasPermission
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Hook para usar o contexto
export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }

  return context
}

// Hook para verificar permissões
export function usePermissions() {
  const { hasPermission } = useAuth()

  return {
    hasPermission,
    isAdmin: hasPermission('admin'),
    canManageUsers: hasPermission('user_management'),
    canManageInstances: hasPermission('instance_management'),
    canViewDashboard: hasPermission('dashboard')
  }
}

export default AuthContext

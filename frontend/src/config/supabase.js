import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY
const backendApiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001'
const apiKey = process.env.REACT_APP_API_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase configuration missing')
}

// Cliente Supabase para operações diretas (se necessário)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Configuração da API com chave para iframe
export const apiConfig = {
  baseURL: backendApiUrl,
  apiKey: apiKey,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': apiKey
  }
}

// Função auxiliar para obter o token JWT do localStorage
const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Interceptor para adicionar API key e JWT token em todas as requisições
export const apiClient = {
  async get(url, config = {}) {
    const token = getAuthToken()
    const headers = {
      'Content-Type': 'application/json',
      ...config.headers
    }
    
    // MULTI-TENANCY: Se tem JWT token, usar APENAS ele (não enviar api_key)
    // Se não tem JWT, usar api_key para autenticação básica
    let finalUrl = `${backendApiUrl}${url}`
    
    if (token) {
      // Modo multi-tenancy: usar JWT token
      headers['Authorization'] = `Bearer ${token}`
      console.log('🔐 Usando JWT token para autenticação')
    } else {
      // Modo legado: usar API key
      headers['x-api-key'] = apiKey
      finalUrl += url.includes('?') ? `&api_key=${apiKey}` : `?api_key=${apiKey}`
      console.log('🔑 Usando API Key para autenticação')
    }
    
    const response = await fetch(finalUrl, {
      method: 'GET',
      headers,
      ...config
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return response.json()
  },

  async post(url, data, config = {}) {
    const token = getAuthToken()
    const headers = {
      'Content-Type': 'application/json',
      ...config.headers
    }
    
    let bodyData = { ...data }
    
    // MULTI-TENANCY: Se tem JWT token, usar APENAS ele
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
      console.log('🔐 Usando JWT token para autenticação (POST)')
    } else {
      headers['x-api-key'] = apiKey
      bodyData.api_key = apiKey
      console.log('🔑 Usando API Key para autenticação (POST)')
    }
    
    const response = await fetch(`${backendApiUrl}${url}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyData),
      ...config
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return response.json()
  },

  async put(url, data, config = {}) {
    const token = getAuthToken()
    const headers = {
      'Content-Type': 'application/json',
      ...config.headers
    }
    
    let bodyData = { ...data }
    
    // MULTI-TENANCY: Se tem JWT token, usar APENAS ele
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    } else {
      headers['x-api-key'] = apiKey
      bodyData.api_key = apiKey
    }
    
    const response = await fetch(`${backendApiUrl}${url}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(bodyData),
      ...config
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return response.json()
  },

  async delete(url, config = {}) {
    const token = getAuthToken()
    const headers = {
      'Content-Type': 'application/json',
      ...config.headers
    }
    
    // MULTI-TENANCY: Se tem JWT token, usar APENAS ele
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    } else {
      headers['x-api-key'] = apiKey
    }
    
    const response = await fetch(`${backendApiUrl}${url}`, {
      method: 'DELETE',
      headers,
      ...config
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return response.json()
  }
}

export default apiClient
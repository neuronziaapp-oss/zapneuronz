import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import RegisterForm from '../components/auth/RegisterForm'
import { toast } from 'react-toastify'
import api from '../services/api'

const RegisterPage = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [registrationEnabled, setRegistrationEnabled] = useState(false)
  const [checkingRegistration, setCheckingRegistration] = useState(true)

  // Verificar se registro está habilitado
  useEffect(() => {
    checkRegistrationStatus()
  }, [])

  const checkRegistrationStatus = async () => {
    try {
      const response = await api.get('/auth/registration-status')
      setRegistrationEnabled(response.data.enabled)
      
      // Se está em modo iframe e registro não está habilitado, redirecionar
      if (response.data.iframeMode && !response.data.enabled) {
        navigate('/dashboard')
        return
      }
    } catch (error) {
      console.error('Erro ao verificar status de registro:', error)
      toast.error('Erro ao verificar configuração de registro')
    } finally {
      setCheckingRegistration(false)
    }
  }

  const handleRegister = async (formData) => {
    setLoading(true)
    
    try {
      const response = await api.post('/auth/register', {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword
      })

      // Login automático após registro
      await login(response.data.token, response.data.user)
      
      toast.success('Conta criada com sucesso! Bem-vindo!')
      navigate('/dashboard')
      
    } catch (error) {
      console.error('Erro no registro:', error)
      
      if (error.response?.data?.error) {
        toast.error(error.response.data.error)
      } else {
        toast.error('Erro ao criar conta. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Loading inicial
  if (checkingRegistration) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando configurações...</p>
        </div>
      </div>
    )
  }

  // Se registro não está habilitado
  if (!registrationEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-8 w-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Registro Não Disponível
            </h2>
            <p className="text-gray-600 mb-6">
              O registro de novos usuários não está habilitado no momento.
              Entre em contato com o administrador para criar sua conta.
            </p>
            
            <div className="space-y-3">
              <Link
                to="/login"
                className="w-full inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
              >
                Ir para Login
              </Link>
              
              <p className="text-xs text-gray-500">
                Já tem uma conta? Faça login acima.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <RegisterForm 
      onRegister={handleRegister} 
      loading={loading}
    />
  )
}

export default RegisterPage
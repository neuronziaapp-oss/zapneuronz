import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import socketService from '../services/socket'

const SocketContext = createContext()

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket deve ser usado dentro do SocketProvider')
  }
  return context
}

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth()
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState(null)

  useEffect(() => {
    let socketInstance = null

    if (isAuthenticated && user) {
      // Conectar ao socket quando o usuário estiver autenticado
      socketInstance = socketService.connect()

      socketInstance.on('connect', () => {
        console.log('✅ Socket conectado no SocketContext')
        console.log('🔍 Socket ID:', socketInstance.id)
        console.log('🔍 Socket transport:', socketInstance.io?.engine?.transport?.name)
        setIsConnected(true)
        setConnectionError(null)
      })

      socketInstance.on('disconnect', reason => {
        console.log('❌ Socket desconectado:', reason)
        setIsConnected(false)
      })

      socketInstance.on('connect_error', error => {
        console.error('❌ Erro de conexão socket:', error)
        setConnectionError(error.message)
        setIsConnected(false)
      })

      setSocket(socketInstance)
    }

    return () => {
      if (socketInstance) {
        console.log('🔌 Desconectando socket...')
        socketInstance.disconnect()
        setSocket(null)
        setIsConnected(false)
      }
    }
  }, [isAuthenticated, user])

  // Função para reconectar
  const reconnect = () => {
    if (socket) {
      socket.connect()
    }
  }

  // Função para emitir eventos
  const emit = (event, data) => {
    if (socket && isConnected) {
      socket.emit(event, data)
      return true
    }
    console.warn('Socket não conectado. Evento não enviado:', event)
    return false
  }

  // Função para escutar eventos
  const on = (event, callback) => {
    if (socket) {
      socket.on(event, callback)
      return () => socket.off(event, callback)
    }
    return () => {}
  }

  // Função para parar de escutar eventos
  const off = (event, callback) => {
    if (socket) {
      socket.off(event, callback)
    }
  }

  const value = {
    socket,
    isConnected,
    connectionError,
    reconnect,
    emit,
    on,
    off
  }

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  )
}

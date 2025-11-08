import React from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
} from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

// Contexts
import { AuthProvider } from './contexts/AuthContext'
import { AppProvider } from './contexts/AppContext'
import { SocketProvider } from './contexts/SocketContext'

// Components
import ProtectedRoute from './components/ProtectedRoute'
import ConnectedSyncProgressBar from './components/common/ConnectedSyncProgressBar'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import ChatOnlyPage from './pages/ChatOnlyPage'

// Styles
import './index.css'

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="App min-h-screen bg-gray-100">
          <Routes>
            {/* Rota de Login */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Rota de Registro */}
            <Route path="/register" element={<RegisterPage />} />

            {/* Rotas Protegidas */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <SocketProvider>
                    <AppProvider>
                      <DashboardPage />
                      <ConnectedSyncProgressBar />
                    </AppProvider>
                  </SocketProvider>
                </ProtectedRoute>
              }
            />

            {/* Rota de Chat Standalone */}
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <SocketProvider>
                    <AppProvider>
                      <ChatOnlyPage />
                    </AppProvider>
                  </SocketProvider>
                </ProtectedRoute>
              }
            />

            {/* Redirecionamento padrão */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Rota 404 - redireciona para dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>

          {/* Toast Notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff'
              },
              success: {
                duration: 3000,
                theme: {
                  primary: '#10B981'
                }
              },
              error: {
                duration: 5000,
                theme: {
                  primary: '#EF4444'
                }
              }
            }}
          />
        </div>
      </AuthProvider>
    </Router>
  )
}

export default App

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SyncProgressBar = ({ 
  isVisible = false, 
  progress = 0, 
  step = '', 
  type = 'manual',
  contactsProcessed = 0,
  totalContacts = 0,
  chatsProcessed = 0,
  totalChats = 0,
  status = 'processing'
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'starting':
      case 'processing':
      case 'finalizing':
        return 'bg-blue-500'
      case 'completed':
        return 'bg-green-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-blue-500'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'starting':
      case 'processing':
      case 'finalizing':
        return (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
          />
        )
      case 'completed':
        return (
          <motion.svg
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-4 h-4 text-white"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path 
              fillRule="evenodd" 
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
              clipRule="evenodd" 
            />
          </motion.svg>
        )
      case 'error':
        return (
          <motion.svg
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-4 h-4 text-white"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path 
              fillRule="evenodd" 
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" 
              clipRule="evenodd" 
            />
          </motion.svg>
        )
      default:
        return null
    }
  }

  const getTypeLabel = () => {
    return type === 'auto' ? 'Sincronização Automática' : 'Sincronização Manual'
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.95 }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 30 
          }}
          className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md mx-auto"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className={`${getStatusColor()} px-4 py-3`}>
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center space-x-2">
                  {getStatusIcon()}
                  <span className="font-medium text-sm">
                    {getTypeLabel()}
                  </span>
                </div>
                <div className="text-xs font-mono">
                  {progress}%
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="px-4 py-3 space-y-3">
              <div className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                {step}
              </div>

              {/* Main Progress */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`h-2 ${getStatusColor()} rounded-full`}
                />
              </div>

              {/* Detailed Stats */}
              {(totalContacts > 0 || totalChats > 0) && (
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  {totalContacts > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                      <div className="text-gray-500 dark:text-gray-400 mb-1">
                        Contatos
                      </div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {contactsProcessed.toLocaleString()} / {totalContacts.toLocaleString()}
                      </div>
                      {totalContacts > 0 && (
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1 mt-1">
                          <div 
                            className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${Math.min(100, (contactsProcessed / totalContacts) * 100)}%` 
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {totalChats > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                      <div className="text-gray-500 dark:text-gray-400 mb-1">
                        Chats
                      </div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {chatsProcessed.toLocaleString()} / {totalChats.toLocaleString()}
                      </div>
                      {totalChats > 0 && (
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1 mt-1">
                          <div 
                            className="bg-green-500 h-1 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${Math.min(100, (chatsProcessed / totalChats) * 100)}%` 
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Status Messages */}
              {status === 'completed' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-green-600 dark:text-green-400 flex items-center space-x-1"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Sincronização concluída com sucesso!</span>
                </motion.div>
              )}

              {status === 'error' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-red-600 dark:text-red-400 flex items-center space-x-1"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>Erro na sincronização. Tente novamente.</span>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default SyncProgressBar
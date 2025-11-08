import React from 'react';

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  className = '',
  overlayClassName = '',
  bodyClassName = '',
  fullscreen = false,
  ...props 
}) => {
  // Tamanhos do modal
  const sizes = {
    xs: 'max-w-xs',
    sm: 'max-w-sm', 
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-full mx-4'
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose();
    }
  };

  React.useEffect(() => {
    const handleKeyDownWrapper = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDownWrapper);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDownWrapper);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Não renderizar se não estiver aberto
  if (!isOpen) return null;

  const containerClasses = fullscreen
    ? `fixed inset-0 z-50 flex flex-col ${overlayClassName}`
    : `fixed inset-0 z-50 flex items-center justify-center p-4 ${overlayClassName}`

  const panelClasses = fullscreen
    ? `relative bg-white shadow-xl w-full h-full max-h-full transform transition-all flex flex-col overflow-hidden rounded-none ${className}`
    : `relative bg-white rounded-lg shadow-xl w-full ${sizes[size]} transform transition-all overflow-hidden flex flex-col ${className}`

  return (
    <div 
      className={containerClasses}
      onClick={handleOverlayClick}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity" />
      
      {/* Modal */}
      <div className={panelClasses} {...props}>
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
            {title && (
              <h3 className="text-lg font-semibold text-gray-900">
                {title}
              </h3>
            )}
            
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="
                  text-gray-400 hover:text-gray-600 
                  focus:outline-none focus:ring-2 focus:ring-gray-300
                  rounded-md p-1 transition-colors
                "
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className={`p-4 ${fullscreen ? 'flex-1 overflow-y-auto' : ''} ${bodyClassName}`}>
          {children}
        </div>
      </div>
    </div>
  );
};

// Modal Footer Component
export const ModalFooter = ({ children, className = '' }) => {
  return (
    <div className={`flex items-center justify-end space-x-3 px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg ${className}`}>
      {children}
    </div>
  );
};

// Modal Body Component
export const ModalBody = ({ children, className = '' }) => {
  return (
    <div className={`p-4 ${className}`}>
      {children}
    </div>
  );
};

// Confirmation Modal
export const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Confirmação',
  message = 'Tem certeza que deseja continuar?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'warning' // success, warning, danger
}) => {
  const typeColors = {
    success: {
      icon: '✓',
      iconBg: 'bg-green-100',
      iconText: 'text-green-600',
      button: 'bg-green-600 hover:bg-green-700'
    },
    warning: {
      icon: '⚠',
      iconBg: 'bg-yellow-100',
      iconText: 'text-yellow-600',
      button: 'bg-yellow-600 hover:bg-yellow-700'
    },
    danger: {
      icon: '⚠',
      iconBg: 'bg-red-100',
      iconText: 'text-red-600',
      button: 'bg-red-600 hover:bg-red-700'
    }
  };

  const config = typeColors[type] || typeColors.warning;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" title={title}>
      <div className="flex items-start space-x-4">
        {/* Icon */}
        <div className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full ${config.iconBg}`}>
          <span className={`text-xl ${config.iconText}`}>
            {config.icon}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1">
          <p className="text-gray-700">
            {message}
          </p>
        </div>
      </div>

      {/* Actions */}
      <ModalFooter className="mt-6">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${config.button}`}
        >
          {confirmText}
        </button>
      </ModalFooter>
    </Modal>
  );
};

export default Modal;

import React, { useState, useEffect } from 'react';
import apiService from '../../services/api';
import { useApp } from '../../contexts/AppContext';

const ImageMessage = ({ message }) => {
  const { state } = useApp();
  const [imageData, setImageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (message.messageType === 'imageMessage' && message.messageId && state.currentInstance?.id) {
      loadImage();
    }
  }, [message.messageId, state.currentInstance?.id]);

  const loadImage = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.getBase64FromMediaMessage(
        state.currentInstance.id, 
        message.messageId
      );
      
      // A resposta deve conter a imagem em base64
      if (response.base64) {
        setImageData(`data:${message.mediaMimeType || 'image/jpeg'};base64,${response.base64}`);
      } else if (response.media) {
        // Caso a resposta venha em outro formato
        setImageData(response.media);
      } else {
        throw new Error('Formato de resposta não esperado');
      }
      
    } catch (err) {
      console.error('Erro ao carregar imagem:', err);
      setError('Erro ao carregar imagem');
    } finally {
      setLoading(false);
    }
  };

  const handleImageError = () => {
    setError('Falha ao exibir imagem');
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center w-64 h-48 bg-gray-200 rounded-lg">
        <div className="flex flex-col items-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
          <span className="text-sm text-gray-500">Carregando imagem...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-64 h-48 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="mt-2 text-sm text-gray-500">{error}</p>
          <button 
            onClick={loadImage}
            className="mt-2 text-sm text-blue-500 hover:text-blue-700"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-sm">
      <img 
        src={imageData}
        alt={message.content || "Imagem"}
        className="rounded-lg max-w-full h-auto shadow-md cursor-pointer hover:shadow-lg transition-shadow"
        onError={handleImageError}
        onClick={() => {
          // Abrir imagem em uma nova aba para visualização completa
          const newWindow = window.open();
          newWindow.document.write(`
            <html>
              <head><title>Imagem - WhatsApp</title></head>
              <body style="margin:0; display:flex; justify-content:center; align-items:center; min-height:100vh; background:#000;">
                <img src="${imageData}" style="max-width:100%; max-height:100vh; object-fit:contain;" />
              </body>
            </html>
          `);
        }}
        loading="lazy"
      />
      {/* Mostrar conteúdo da mensagem se houver (além do emoji padrão) */}
      {message.content && message.content !== '📷 Imagem' && (
        <p className="text-sm mt-2">{message.content}</p>
      )}
    </div>
  );
};

export default ImageMessage;
import React, { useState, useEffect, useRef, useCallback } from 'react';
import apiService from '../../services/api';
import { useApp } from '../../contexts/AppContext';

const MediaMessage = ({ message, normalizedType }) => {
  const { state } = useApp();
  const [mediaData, setMediaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mediaType, setMediaType] = useState('image'); // 'image', 'video', 'document', 'audio' ou 'sticker'
  const [fileName, setFileName] = useState('');
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef(null);
  const messageUniqueId =
    message.messageId ||
    message.id ||
    message.message_id ||
    message.messageID ||
    null;
  const currentInstanceId = state.currentInstance?.id;
  const defaultMimeType = message.mediaMimeType;

  const getTypeLabel = type => {
    switch (type) {
      case 'video':
        return 'vídeo';
      case 'document':
        return 'documento';
      case 'audio':
        return 'áudio';
      case 'sticker':
        return 'figurinha';
      default:
        return 'imagem';
    }
  };

  const loadMedia = useCallback(
    async (convertToMp4 = false, typeOverride = null) => {
      if (!messageUniqueId || !currentInstanceId) {
        return;
      }

      const targetType = typeOverride || 'image';
      const typeLabel = getTypeLabel(targetType);

      try {
        setLoading(true);
        setError(null);
        setMediaType(targetType);

        console.log(`📱 Carregando ${typeLabel}: ${messageUniqueId}`);

        const response = await apiService.getBase64FromMediaMessage(
          currentInstanceId,
          messageUniqueId,
          convertToMp4
        );

        if (response.base64) {
          let mimeType = defaultMimeType;

          if (!mimeType) {
            if (response.mimetype) {
              mimeType = response.mimetype;
            } else if (targetType === 'video' || convertToMp4) {
              mimeType = 'video/mp4';
            } else if (targetType === 'audio') {
              mimeType = 'audio/ogg';
            } else if (targetType === 'sticker') {
              mimeType = 'image/webp';
            } else if (targetType === 'document') {
              mimeType = 'application/octet-stream';
            } else {
              mimeType = 'image/jpeg';
            }
          }

          setMediaData(`data:${mimeType};base64,${response.base64}`);
        } else if (response.media) {
          setMediaData(response.media);
        } else {
          throw new Error('Formato de resposta não esperado');
        }
      } catch (err) {
        console.error(`Erro ao carregar ${typeLabel}:`, err);
        setError(`Erro ao carregar ${typeLabel}`);
      } finally {
        setLoading(false);
      }
    },
    [currentInstanceId, messageUniqueId, defaultMimeType]
  );

  useEffect(() => {
    if (!messageUniqueId || !currentInstanceId) {
      return;
    }

    const rawType = (normalizedType || message.messageType || '')
      .toString()
      .toLowerCase();
    const mimeType = defaultMimeType;

    if (
      rawType.includes('sticker') ||
      Boolean(message.message?.stickerMessage)
    ) {
      loadMedia(false, 'sticker');
      return;
    }

    if (
      rawType.includes('video') ||
      (mimeType && mimeType.startsWith('video/')) ||
      Boolean(message.message?.videoMessage)
    ) {
      loadMedia(true, 'video');
      return;
    }

    if (
      rawType.includes('document') ||
      Boolean(message.message?.documentMessage)
    ) {
      if (message.message?.documentMessage?.fileName) {
        setFileName(message.message.documentMessage.fileName);
      } else if (message.fileName) {
        setFileName(message.fileName);
      }
      loadMedia(false, 'document');
      return;
    }

    if (
      rawType.includes('audio') ||
      rawType.includes('ptt') ||
      Boolean(message.message?.audioMessage)
    ) {
      const seconds =
        message.message?.audioMessage?.seconds ??
        message.metadata?.durationSeconds ??
        message.seconds ??
        0;
      setAudioDuration(seconds);
      loadMedia(false, 'audio');
      return;
    }

    if (
      rawType.includes('image') ||
      (mimeType && mimeType.startsWith('image/') && !rawType.includes('sticker')) ||
      Boolean(message.message?.imageMessage)
    ) {
      loadMedia(false, 'image');
      return;
    }

    loadMedia(false, 'image');
  }, [
    currentInstanceId,
    defaultMimeType,
    loadMedia,
    message.fileName,
    message.message,
    message.metadata,
    message.seconds,
    messageUniqueId,
    normalizedType
  ]);

  const handleMediaError = () => {
    const errorMessage = getTypeLabel(mediaType);
    setError(`Falha ao exibir ${errorMessage}`);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center w-64 h-48 bg-gray-200 rounded-lg">
        <div className="flex flex-col items-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
          <span className="text-sm text-gray-500">
            {mediaType === 'video' 
              ? 'Carregando vídeo...' 
              : mediaType === 'document' 
                ? 'Carregando documento...' 
                : mediaType === 'audio'
                  ? 'Carregando áudio...'
                  : mediaType === 'sticker'
                    ? 'Carregando figurinha...'
                    : 'Carregando imagem...'}
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-64 h-48 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mediaType === 'video' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            ) : mediaType === 'document' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            ) : mediaType === 'audio' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            ) : mediaType === 'sticker' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l3.586-3.586a2 2 0 012.828 0L22 12m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            )}
          </svg>
          <p className="mt-2 text-sm text-gray-500">{error}</p>
          <button 
            onClick={() => loadMedia(mediaType === 'video', mediaType)}
            className="mt-2 text-sm text-blue-500 hover:text-blue-700"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (mediaType === 'video') {
    return (
      <div className="max-w-sm">
        <video 
          src={mediaData}
          controls
          className="rounded-lg max-w-full shadow-md hover:shadow-lg transition-shadow"
          onError={handleMediaError}
          preload="metadata"
        />
        {/* Mostrar conteúdo da mensagem se houver (além do emoji padrão) */}
        {message.content && message.content !== '🎥 Vídeo' && (
          <p className="text-sm mt-2">{message.content}</p>
        )}
      </div>
    );
  }

  // Para áudio
  if (mediaType === 'audio') {
    // Função para formatar o tempo em minutos:segundos
    const formatTime = (seconds) => {
      if (!seconds || isNaN(seconds)) return "00:00";
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
      <div className="min-w-[280px] md:min-w-[320px]">
        <div className="bg-gray-100 p-4 rounded-lg shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 flex items-center justify-center bg-blue-100 rounded-full">
              <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {message.message?.audioMessage?.ptt ? 'Mensagem de Voz' : 'Áudio'}
              </p>
              <p className="text-xs text-gray-500">{formatTime(audioDuration)}</p>
            </div>
          </div>
          
          <audio 
            ref={audioRef}
            src={mediaData} 
            className="w-full mt-3" 
            style={{ minWidth: '250px' }}
            controls
            onError={handleMediaError}
            preload="metadata"
          />
          
          {/* Mostrar conteúdo da mensagem se houver (além do emoji padrão) */}
          {message.content && message.content !== '🎵 Áudio' && message.content !== '🎤 Mensagem de Voz' && (
            <p className="text-sm mt-2">{message.content}</p>
          )}
        </div>
      </div>
    );
  }

  // Para documentos
  if (mediaType === 'document') {
    // Determinar se é PDF ou outro tipo de documento
    const isPdf = (message.mediaMimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf'));

    return (
      <div className="max-w-sm">
        <div className="flex flex-col p-3 bg-gray-50 rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium text-gray-900 truncate">{fileName || 'Documento'}</p>
              <p className="text-xs text-gray-500">{message.mediaMimeType || 'Documento'}</p>
            </div>
          </div>
          
          {/* Botão para baixar o documento */}
          <a 
            href={mediaData}
            download={fileName || 'documento'}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white text-center text-sm font-medium rounded-md transition-colors"
          >
            Baixar Documento
          </a>
        </div>
        
        {/* Mostrar conteúdo da mensagem se houver */}
        {message.content && message.content !== '📎 Documento' && (
          <p className="text-sm mt-2">{message.content}</p>
        )}
      </div>
    );
  }

  if (mediaType === 'sticker') {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-2xl border border-emerald-100 bg-white/80 p-3 shadow-sm">
          <img
            src={mediaData}
            alt="Sticker"
            className="h-32 w-32 object-contain"
            onError={handleMediaError}
            loading="lazy"
          />
        </div>
        {message.content && message.content !== '😄 Sticker' && (
          <p className="max-w-[180px] text-center text-xs text-gray-600">{message.content}</p>
        )}
      </div>
    );
  }

  // Para imagens
  return (
    <div className="max-w-sm">
      <img 
        src={mediaData}
        alt={message.content || "Imagem"}
        className="rounded-lg max-w-full h-auto shadow-md cursor-pointer hover:shadow-lg transition-shadow"
        onError={handleMediaError}
        onClick={() => {
          // Abrir imagem em uma nova aba para visualização completa
          const newWindow = window.open();
          newWindow.document.write(`
            <html>
              <head><title>Imagem - WhatsApp</title></head>
              <body style="margin:0; display:flex; justify-content:center; align-items:center; min-height:100vh; background:#000;">
                <img src="${mediaData}" style="max-width:100%; max-height:100vh; object-fit:contain;" />
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

export default MediaMessage;
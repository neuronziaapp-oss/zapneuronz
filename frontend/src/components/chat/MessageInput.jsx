import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { useApp } from '../../contexts/AppContext';

const MessageInput = () => {
  const {
    state,
    sendMessage,
    sendMediaAttachment,
    sendAudioAttachment,
    sendStickerAttachment
  } = useApp();

  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAudioSending, setIsAudioSending] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [recordingError, setRecordingError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState(null);

  const attachmentButtonRef = useRef(null);
  const attachmentMenuRef = useRef(null);
  const documentInputRef = useRef(null);
  const mediaInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const stickerInputRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const textareaRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const recordingDurationRef = useRef(0);
  const shouldSaveRecordingRef = useRef(true);
  const recordedAudioRef = useRef(null);

  const hasActiveChat = Boolean(state.currentChat);
  const isBusy = isLoading || isAudioSending;
  const mediaRecorderSupported =
    typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined';

  const fileToBase64 = file =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result || '';
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });

  const blobToBase64 = blob =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result || '';
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(blob);
    });

  const formatDuration = seconds => {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = Math.floor(safeSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
      .toString()
      .padStart(2, '0')}`;
  };

  const releaseAudioPreview = audio => {
    if (audio?.url) {
      URL.revokeObjectURL(audio.url);
    }
  };

  const setAudioPreview = newAudio => {
    setRecordedAudio(prev => {
      if (prev && prev !== newAudio) {
        releaseAudioPreview(prev);
      }
      recordedAudioRef.current = newAudio;
      return newAudio;
    });
  };

  const discardRecordedAudio = () => {
    setAudioPreview(null);
    recordingDurationRef.current = 0;
    setRecordingDuration(0);
  };

  const resetFileInputs = () => {
    if (documentInputRef.current) documentInputRef.current.value = '';
    if (mediaInputRef.current) mediaInputRef.current.value = '';
    if (audioInputRef.current) audioInputRef.current.value = '';
    if (stickerInputRef.current) stickerInputRef.current.value = '';
  };

  const stopRecordingTimer = () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  const stopStreamTracks = () => {
    if (mediaStreamRef.current) {
      const tracks = mediaStreamRef.current.getTracks?.();
      if (tracks) {
        tracks.forEach(track => track.stop());
      }
      mediaStreamRef.current = null;
    }
  };

  const resetMediaRecorder = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
    }
    mediaRecorderRef.current = null;
  };

  const startRecording = async () => {
    if (isBusy || isRecording) return;

    if (!mediaRecorderSupported || !navigator.mediaDevices?.getUserMedia) {
      setRecordingError('Gravação de áudio não suportada neste navegador.');
      return;
    }

    setRecordingError('');
    discardRecordedAudio();
    setShowAttachmentMenu(false);
    setShowEmojiPicker(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      shouldSaveRecordingRef.current = true;

      recorder.ondataavailable = event => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopRecordingTimer();
        setIsRecording(false);
        stopStreamTracks();

        const shouldSave = shouldSaveRecordingRef.current;
        shouldSaveRecordingRef.current = true;

        const chunks = recordingChunksRef.current;
        recordingChunksRef.current = [];

        if (!shouldSave || !chunks.length) {
          resetMediaRecorder();
          return;
        }

        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: mimeType });
        const durationSeconds = Math.max(
          1,
          Math.round(recordingDurationRef.current || 1)
        );
        const extension = mimeType.includes('ogg')
          ? 'ogg'
          : mimeType.includes('mp3')
            ? 'mp3'
            : mimeType.includes('wav')
              ? 'wav'
              : 'webm';

        const fileName = `voice-${Date.now()}.${extension}`;

        setAudioPreview({
          blob,
          url: URL.createObjectURL(blob),
          mimeType,
          duration: durationSeconds,
          fileName
        });
        setRecordingDuration(durationSeconds);
        recordingDurationRef.current = durationSeconds;

        resetMediaRecorder();
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;

      setIsRecording(true);
      recordingDurationRef.current = 0;
      setRecordingDuration(0);
      stopRecordingTimer();
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          const next = prev + 1;
          recordingDurationRef.current = next;
          return next;
        });
      }, 1000);
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      setRecordingError('Não foi possível acessar o microfone. Verifique as permissões.');
      stopStreamTracks();
      resetMediaRecorder();
      stopRecordingTimer();
      setIsRecording(false);
    }
  };

  const handleStopRecording = () => {
    if (!mediaRecorderRef.current) {
      return;
    }

    shouldSaveRecordingRef.current = true;

    try {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch (error) {
      console.error('Erro ao finalizar gravação:', error);
      setRecordingError('Erro ao finalizar a gravação.');
      stopRecordingTimer();
      stopStreamTracks();
      resetMediaRecorder();
      setIsRecording(false);
    }
  };

  const handleCancelRecording = () => {
    shouldSaveRecordingRef.current = false;

    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch (error) {
      console.error('Erro ao cancelar gravação:', error);
    }

    stopRecordingTimer();
    stopStreamTracks();
    resetMediaRecorder();
    setIsRecording(false);
    discardRecordedAudio();
    setRecordingError('');
  };

  const sendRecordedAudio = async () => {
    if (!recordedAudio?.blob) {
      return;
    }

    setRecordingError('');
    setIsAudioSending(true);
    setIsLoading(true);

    try {
      const base64 = await blobToBase64(recordedAudio.blob);
      const durationSeconds = Math.max(
        1,
        Math.round(recordedAudio.duration || recordingDurationRef.current || 1)
      );

      const metadata = {
        durationSeconds,
        fileName: recordedAudio.fileName
      };

      await sendAudioAttachment({
        audio: base64,
        mimetype: recordedAudio.mimeType || 'audio/webm',
        ptt: true,
        durationSeconds,
        metadata,
        fileName: recordedAudio.fileName
      });

      discardRecordedAudio();
      setShowAttachmentMenu(false);
    } catch (error) {
      console.error('Erro ao enviar áudio gravado:', error);
      setRecordingError('Erro ao enviar a mensagem de voz. Tente novamente.');
    } finally {
      setIsAudioSending(false);
      setIsLoading(false);
    }
  };

  const handleSubmit = async event => {
    event.preventDefault();

    if (!message.trim()) return;

    setIsLoading(true);
    try {
      await sendMessage(message.trim());
      setMessage('');
      setShowEmojiPicker(false);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  const handleAttachmentToggle = () => {
    setShowAttachmentMenu(prev => !prev);
    setShowEmojiPicker(false);
  };

  const handleEmojiToggle = () => {
    setShowEmojiPicker(prev => !prev);
    setShowAttachmentMenu(false);
  };

  const handleEmojiSelect = emojiData => {
    const emoji = emojiData?.emoji;
    if (!emoji) return;

    const textarea = textareaRef.current;

    if (!textarea) {
      setMessage(prev => `${prev}${emoji}`);
      return;
    }

    const selectionStart = textarea.selectionStart ?? textarea.value.length;
    const selectionEnd = textarea.selectionEnd ?? textarea.value.length;

    setMessage(prev => {
      const before = prev.slice(0, selectionStart);
      const after = prev.slice(selectionEnd);
      const updatedMessage = `${before}${emoji}${after}`;

      requestAnimationFrame(() => {
        textarea.focus();
        const cursorPosition = selectionStart + emoji.length;
        textarea.setSelectionRange(cursorPosition, cursorPosition);
      });

      return updatedMessage;
    });
  };

  const handleFileSelection = async (type, files) => {
    const file = files?.[0];
    if (!file) return;

    const caption = message.trim();
    setIsLoading(true);
    setRecordingError('');

    try {
      const base64 = await fileToBase64(file);

      if (type === 'document') {
        await sendMediaAttachment({
          mediatype: 'document',
          mimetype: file.type || 'application/octet-stream',
          caption,
          media: base64,
          fileName: file.name
        });
      } else if (type === 'media') {
        const isVideo = file.type?.startsWith('video/');
        const mediatype = isVideo ? 'video' : 'image';

        await sendMediaAttachment({
          mediatype,
          mimetype: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
          caption,
          media: base64,
          fileName: file.name
        });
      } else if (type === 'audio') {
        await sendAudioAttachment({
          audio: base64,
          mimetype: file.type || 'audio/mpeg',
          ptt: false,
          fileName: file.name,
          metadata: {
            fileName: file.name
          }
        });
      } else if (type === 'sticker') {
        await sendStickerAttachment({
          sticker: base64
        });
      }

      setMessage('');
      discardRecordedAudio();
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
      setRecordingError('Erro ao enviar arquivo. Tente novamente.');
    } finally {
      setIsLoading(false);
      setShowAttachmentMenu(false);
      setShowEmojiPicker(false);
      resetFileInputs();
    }
  };

  const handleMicButtonClick = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      startRecording();
    }
  };

  useEffect(() => {
    if (!showAttachmentMenu) return;

    const handleClickOutside = event => {
      if (
        attachmentMenuRef.current &&
        !attachmentMenuRef.current.contains(event.target) &&
        attachmentButtonRef.current &&
        !attachmentButtonRef.current.contains(event.target)
      ) {
        setShowAttachmentMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAttachmentMenu]);

  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleClickOutside = event => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    const handleEscape = event => {
      if (event.key === 'Escape') {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showEmojiPicker]);

  useEffect(() => {
    if (!hasActiveChat) {
      handleCancelRecording();
      setShowAttachmentMenu(false);
      setShowEmojiPicker(false);
    }
  }, [hasActiveChat]);

  useEffect(() => {
    if ((isBusy || isRecording) && showEmojiPicker) {
      setShowEmojiPicker(false);
    }
  }, [isBusy, isRecording, showEmojiPicker]);

  useEffect(() => {
    return () => {
      stopRecordingTimer();

      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch (error) {
        console.error('Erro ao limpar media recorder:', error);
      }

      stopStreamTracks();
      resetMediaRecorder();
      releaseAudioPreview(recordedAudioRef.current);
      recordedAudioRef.current = null;
    };
  }, []);

  if (!hasActiveChat) {
    return null;
  }

  const attachmentOptions = [
    {
      key: 'document',
      label: 'Document',
      description: 'Enviar PDF, DOCX, XLSX... ',
      onClick: () => documentInputRef.current?.click(),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      )
    },
    {
      key: 'media',
      label: 'Photos & videos',
      description: 'Enviar imagem ou vídeo',
      onClick: () => mediaInputRef.current?.click(),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7a2 2 0 012-2h3l2-2h4l2 2h3a2 2 0 012 2v11a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      )
    },
    {
      key: 'audio',
      label: 'Audio',
      description: 'Enviar áudio ou mensagem de voz',
      onClick: () => audioInputRef.current?.click(),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
          />
        </svg>
      )
    },
    {
      key: 'sticker',
      label: 'Sticker',
      description: 'Enviar figurinha .webp',
      onClick: () => stickerInputRef.current?.click(),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l3.586-3.586a2 2 0 012.828 0L22 12M16 6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      )
    }
  ];

  return (
    <div className="bg-gray-100 border-t border-gray-200 px-4 py-3">
      {recordingError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {recordingError}
        </div>
      )}

      {isRecording && (
        <div className="mb-3 flex flex-col gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-3 w-3 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
            <span className="text-sm font-medium">Gravando mensagem de voz</span>
            <span className="text-sm font-semibold text-green-600">{formatDuration(recordingDuration)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleStopRecording}
              className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              Parar
            </button>
            <button
              type="button"
              onClick={handleCancelRecording}
              className="rounded-md border border-green-300 px-3 py-1.5 text-sm font-medium text-green-700 transition-colors hover:bg-green-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {recordedAudio && !isRecording && (
        <div className="mb-3 flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
            <div className="flex items-center gap-2 text-blue-700">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
              </svg>
              <span className="text-sm font-medium">Mensagem pronta</span>
              <span className="text-xs text-blue-500">{formatDuration(recordedAudio.duration)}</span>
            </div>
            <audio
              src={recordedAudio.url}
              controls
              className="mt-2 w-full rounded-md bg-white p-2 shadow-sm md:mt-0 md:max-w-xs"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={sendRecordedAudio}
              disabled={isBusy}
              className={`flex items-center gap-2 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors ${
                isBusy ? 'opacity-75' : 'hover:bg-green-700'
              }`}
            >
              {isAudioSending ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 11l5 5m0 0l5-5m-5 5V6"
                    />
                  </svg>
                  Enviar áudio
                </>
              )}
            </button>
            <button
              type="button"
              onClick={discardRecordedAudio}
              disabled={isAudioSending}
              className="rounded-md border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end space-x-3">
        <div className="relative">
          <button
            type="button"
            ref={attachmentButtonRef}
            onClick={handleAttachmentToggle}
            className={`flex-shrink-0 rounded-md p-2 transition-colors ${
              showAttachmentMenu
                ? 'bg-green-100 text-green-600'
                : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
            }`}
            title="Anexar arquivo"
            disabled={isBusy || isRecording}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          </button>

          {showAttachmentMenu && (
            <div
              ref={attachmentMenuRef}
              className="absolute bottom-full left-0 z-20 mb-3 w-64"
            >
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                <div className="py-2">
                  {attachmentOptions.map(option => (
                    <button
                      type="button"
                      key={option.key}
                      onClick={option.onClick}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-gray-100"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-50 text-green-600">
                        {option.icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{option.label}</p>
                        <p className="text-xs text-gray-500">{option.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1">
          <textarea
            value={message}
            onChange={event => setMessage(event.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite uma mensagem"
            disabled={isBusy || isRecording}
            rows={1}
            ref={textareaRef}
            className="w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
        </div>

        <div className="relative">
          <button
            type="button"
            ref={emojiButtonRef}
            onClick={handleEmojiToggle}
            className={`flex-shrink-0 rounded-md p-2 transition-colors ${
              showEmojiPicker
                ? 'bg-green-100 text-green-600'
                : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
            }`}
            title="Emoji"
            disabled={isBusy || isRecording}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>

          {showEmojiPicker && (
            <div
              ref={emojiPickerRef}
              className="absolute bottom-full right-0 z-20 mb-3 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
            >
              <EmojiPicker
                onEmojiClick={handleEmojiSelect}
                theme="light"
                previewConfig={{ showPreview: false }}
                lazyLoadEmojis
                autoFocusSearch={false}
                skinTonesDisabled={false}
                width={320}
                height={380}
              />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleMicButtonClick}
          className={`flex-shrink-0 rounded-md p-2 transition-colors ${
            isRecording
              ? 'bg-red-100 text-red-600'
              : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
          }`}
          title={isRecording ? 'Parar gravação' : 'Gravar mensagem de voz'}
          disabled={!mediaRecorderSupported || isBusy}
        >
          {isRecording ? (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="7" y="7" width="10" height="10" rx="2" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 1a3 3 0 00-3 3v6a3 3 0 106 0V4a3 3 0 00-3-3z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 10v2a7 7 0 01-14 0v-2M12 19v4m-4 0h8"
              />
            </svg>
          )}
        </button>

        <button
          type="submit"
          disabled={!message.trim() || isBusy || isRecording}
          className={`flex-shrink-0 rounded-md p-2 transition-colors ${
            message.trim() && !isBusy && !isRecording
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'cursor-not-allowed bg-gray-300 text-gray-500'
          }`}
        >
          {isLoading ? (
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </form>

      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={event => handleFileSelection('document', event.target.files)}
      />
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={event => handleFileSelection('media', event.target.files)}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={event => handleFileSelection('audio', event.target.files)}
      />
      <input
        ref={stickerInputRef}
        type="file"
        accept="image/webp"
        className="hidden"
        onChange={event => handleFileSelection('sticker', event.target.files)}
      />
    </div>
  );
};

export default MessageInput;

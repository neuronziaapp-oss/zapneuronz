import React from 'react';

const Avatar = ({ 
  src, 
  name, 
  size = 'md', 
  status, 
  className = '', 
  onClick,
  isGroup = false 
}) => {
  // Tamanhos disponíveis
  const sizes = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
    '2xl': 'w-20 h-20 text-2xl'
  };

  // Status de presença
  const statusSizes = {
    xs: 'w-2 h-2',
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-3.5 h-3.5',
    xl: 'w-4 h-4',
    '2xl': 'w-5 h-5'
  };

  // Gerar iniciais se não tiver imagem
  const getInitials = (name) => {
    if (!name) return isGroup ? 'G' : '?';
    const words = name.trim().split(' ').filter(word => word.length > 0);
    if (words.length === 0) return isGroup ? 'G' : '?';
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  // Gerar cor baseada no nome
  const getColorFromName = (name) => {
    if (!name) return '#9CA3AF';
    
    const colors = [
      '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
      '#22C55E', '#10B981', '#06B6D4', '#0EA5E9', '#3B82F6',
      '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899'
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  const initials = getInitials(name);
  const backgroundColor = getColorFromName(name);

  return (
    <div 
      className={`relative inline-block ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {/* Avatar */}
      <div className={`
        ${sizes[size]} 
        rounded-full 
        flex 
        items-center 
        justify-center 
        overflow-hidden 
        bg-gray-300
        ${onClick ? 'hover:opacity-80 transition-opacity' : ''}
      `}>
        {src ? (
          <img 
            src={src} 
            alt={name || 'Avatar'} 
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        
        {/* Fallback com iniciais */}
        <div 
          className={`
            w-full h-full 
            flex items-center justify-center 
            text-white font-medium
            ${src ? 'hidden' : 'flex'}
          `}
          style={{ backgroundColor }}
        >
          {initials}
        </div>
      </div>

      {/* Status de presença */}
      {status && (
        <div className={`
          absolute -bottom-0.5 -right-0.5
          ${statusSizes[size]} 
          rounded-full 
          border-2 border-white
          ${status === 'online' ? 'bg-green-500' : ''}
          ${status === 'offline' ? 'bg-gray-400' : ''}
          ${status === 'typing' ? 'bg-blue-500' : ''}
          ${status === 'recording' ? 'bg-red-500' : ''}
        `} />
      )}

      {/* Indicador de grupo */}
      {isGroup && (
        <div className={`
          absolute -bottom-0.5 -right-0.5 
          ${statusSizes[size]} 
          rounded-full 
          border-2 border-white
          bg-gray-600
          flex items-center justify-center
        `}>
          <svg 
            className="w-2 h-2 text-white" 
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default Avatar;

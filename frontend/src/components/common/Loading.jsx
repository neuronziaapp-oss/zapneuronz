import React from 'react';

const Loading = ({ 
  size = 'md', 
  color = 'primary',
  text,
  fullScreen = false,
  className = '' 
}) => {
  // Tamanhos do spinner
  const sizes = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6', 
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  // Cores do spinner
  const colors = {
    primary: 'text-green-600',
    secondary: 'text-gray-600',
    white: 'text-white',
    blue: 'text-blue-600',
    red: 'text-red-600'
  };

  const Spinner = () => (
    <svg 
      className={`animate-spin ${sizes[size]} ${colors[color]} ${className}`}
      fill="none" 
      viewBox="0 0 24 24"
    >
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
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
        <div className="text-center">
          <Spinner />
          {text && (
            <p className="mt-4 text-sm text-gray-600">{text}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center ${text ? 'flex-col' : ''}`}>
      <Spinner />
      {text && (
        <p className="mt-2 text-sm text-gray-600">{text}</p>
      )}
    </div>
  );
};

// Loading Skeleton
export const LoadingSkeleton = ({ 
  width = '100%', 
  height = '1rem', 
  className = '',
  variant = 'rectangular' // rectangular, circular, text
}) => {
  const baseClasses = 'animate-pulse bg-gray-200';
  
  const variantClasses = {
    rectangular: 'rounded',
    circular: 'rounded-full',
    text: 'rounded h-4'
  };

  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={{ width, height: variant === 'text' ? '1rem' : height }}
    />
  );
};

// Loading Card Skeleton
export const LoadingCard = ({ lines = 3, showAvatar = false }) => {
  return (
    <div className="p-4 border border-gray-200 rounded-lg">
      <div className="flex items-start space-x-3">
        {showAvatar && (
          <LoadingSkeleton variant="circular" width="40px" height="40px" />
        )}
        <div className="flex-1 space-y-2">
          <LoadingSkeleton width="60%" />
          {Array.from({ length: lines }).map((_, index) => (
            <LoadingSkeleton 
              key={index} 
              width={index === lines - 1 ? '40%' : '100%'} 
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Loading List
export const LoadingList = ({ count = 5, showAvatar = false }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <LoadingCard key={index} showAvatar={showAvatar} />
      ))}
    </div>
  );
};

// Dots Loading
export const DotsLoading = ({ 
  size = 'md', 
  color = 'primary',
  className = '' 
}) => {
  const sizes = {
    sm: 'w-1 h-1',
    md: 'w-2 h-2',
    lg: 'w-3 h-3'
  };

  const colors = {
    primary: 'bg-green-600',
    secondary: 'bg-gray-600',
    white: 'bg-white'
  };

  return (
    <div className={`flex space-x-1 items-center ${className}`}>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className={`
            ${sizes[size]} 
            ${colors[color]} 
            rounded-full 
            animate-bounce
          `}
          style={{
            animationDelay: `${index * 0.1}s`,
            animationDuration: '0.6s'
          }}
        />
      ))}
    </div>
  );
};

// Pulse Loading
export const PulseLoading = ({ 
  size = 'md', 
  color = 'primary',
  className = '' 
}) => {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  const colors = {
    primary: 'bg-green-600',
    secondary: 'bg-gray-600',
    white: 'bg-white'
  };

  return (
    <div className={`${sizes[size]} ${colors[color]} rounded-full animate-pulse ${className}`} />
  );
};

export default Loading;

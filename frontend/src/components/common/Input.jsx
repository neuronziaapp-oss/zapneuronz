import React, { forwardRef } from 'react';

const Input = forwardRef(({ 
  label, 
  type = 'text', 
  placeholder, 
  value, 
  onChange, 
  onBlur,
  onFocus,
  error, 
  helperText, 
  disabled = false, 
  required = false,
  className = '', 
  containerClassName = '',
  icon: Icon,
  iconPosition = 'left',
  suffix,
  prefix,
  size = 'md',
  variant = 'default',
  ...props 
}, ref) => {
  // Tamanhos
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  };

  // Variantes
  const variants = {
    default: 'border-gray-300 focus:border-green-500 focus:ring-green-500',
    outline: 'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
    filled: 'border-gray-300 bg-gray-50 focus:bg-white focus:border-green-500 focus:ring-green-500'
  };

  const baseClasses = `
    block w-full rounded-md border
    focus:outline-none focus:ring-1
    disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500
    transition-colors duration-200
  `;

  const sizeClasses = sizes[size] || sizes.md;
  const variantClasses = variants[variant] || variants.default;
  const errorClasses = error 
    ? 'border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500' 
    : variantClasses;

  const inputClasses = `
    ${baseClasses} 
    ${sizeClasses} 
    ${errorClasses}
    ${Icon && iconPosition === 'left' ? 'pl-10' : ''}
    ${Icon && iconPosition === 'right' ? 'pr-10' : ''}
    ${prefix ? 'pl-12' : ''}
    ${suffix ? 'pr-12' : ''}
    ${className}
  `;

  return (
    <div className={`${containerClassName}`}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Input Container */}
      <div className="relative">
        {/* Prefix */}
        {prefix && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">{prefix}</span>
          </div>
        )}

        {/* Icon Left */}
        {Icon && iconPosition === 'left' && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon className={`w-5 h-5 ${error ? 'text-red-400' : 'text-gray-400'}`} />
          </div>
        )}

        {/* Input */}
        <input
          ref={ref}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          disabled={disabled}
          required={required}
          className={inputClasses}
          {...props}
        />

        {/* Icon Right */}
        {Icon && iconPosition === 'right' && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <Icon className={`w-5 h-5 ${error ? 'text-red-400' : 'text-gray-400'}`} />
          </div>
        )}

        {/* Suffix */}
        {suffix && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">{suffix}</span>
          </div>
        )}

        {/* Error Icon */}
        {error && !Icon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path 
                fillRule="evenodd" 
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" 
                clipRule="evenodd" 
              />
            </svg>
          </div>
        )}
      </div>

      {/* Helper Text / Error Message */}
      {(error || helperText) && (
        <p className={`mt-1 text-sm ${error ? 'text-red-600' : 'text-gray-500'}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

// Componente Textarea
export const Textarea = forwardRef(({ 
  label, 
  placeholder, 
  value, 
  onChange, 
  onBlur,
  onFocus,
  error, 
  helperText, 
  disabled = false, 
  required = false,
  rows = 3,
  resize = true,
  className = '', 
  containerClassName = '',
  maxLength,
  showCharCount = false,
  ...props 
}, ref) => {
  const baseClasses = `
    block w-full rounded-md border border-gray-300
    focus:outline-none focus:ring-1 focus:border-green-500 focus:ring-green-500
    disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500
    transition-colors duration-200
    px-4 py-2 text-sm
  `;

  const errorClasses = error 
    ? 'border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500' 
    : '';

  const resizeClasses = resize ? 'resize-y' : 'resize-none';

  return (
    <div className={containerClassName}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={ref}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          disabled={disabled}
          required={required}
          rows={rows}
          maxLength={maxLength}
          className={`${baseClasses} ${errorClasses} ${resizeClasses} ${className}`}
          {...props}
        />

        {/* Character Count */}
        {showCharCount && maxLength && (
          <div className="absolute bottom-2 right-2 text-xs text-gray-400">
            {(value || '').length}/{maxLength}
          </div>
        )}
      </div>

      {/* Helper Text / Error Message */}
      {(error || helperText) && (
        <p className={`mt-1 text-sm ${error ? 'text-red-600' : 'text-gray-500'}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

// Componente Select
export const Select = forwardRef(({ 
  label, 
  options = [], 
  value, 
  onChange, 
  error, 
  helperText, 
  disabled = false, 
  required = false,
  placeholder = 'Selecione uma opção',
  className = '', 
  containerClassName = '',
  ...props 
}, ref) => {
  const baseClasses = `
    block w-full rounded-md border border-gray-300
    focus:outline-none focus:ring-1 focus:border-green-500 focus:ring-green-500
    disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500
    transition-colors duration-200
    px-4 py-2 text-sm
  `;

  const errorClasses = error 
    ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500' 
    : '';

  return (
    <div className={containerClassName}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Select */}
      <select
        ref={ref}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className={`${baseClasses} ${errorClasses} ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option, index) => (
          <option key={index} value={option.value || option}>
            {option.label || option}
          </option>
        ))}
      </select>

      {/* Helper Text / Error Message */}
      {(error || helperText) && (
        <p className={`mt-1 text-sm ${error ? 'text-red-600' : 'text-gray-500'}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Input;

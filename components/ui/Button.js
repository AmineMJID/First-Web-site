'use client';

const variants = {
  primary: 'btn btn-primary',
  secondary: 'btn btn-secondary',
  outline: 'btn btn-outline',
  danger: 'btn btn-danger',
  success: 'btn btn-success',
  ghost: 'btn btn-ghost',
};

const sizes = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
  icon: 'btn-icon',
};

export default function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  disabled,
  loading,
  ...props 
}) {
  const variantClass = variants[variant] || variants.primary;
  const sizeClass = sizes[size] || '';
  return (
    <button 
      className={`${variantClass} ${sizeClass} ${className}`.trim()} 
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="spinner" /> : null}
      {children}
    </button>
  );
}

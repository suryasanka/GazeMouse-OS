import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  isLoading?: boolean
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  isLoading = false,
  disabled,
  className = '',
  style,
  ...props
}) => {
  // Styles based on variant
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          background: 'linear-gradient(135deg, var(--color-primary-blue) 0%, #1d4ed8 100%)',
          color: 'var(--color-text-on-primary, #ffffff)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          boxShadow: 'var(--shadow-sm), 0 0 12px rgba(37, 99, 235, 0.25)',
        }
      case 'secondary':
        return {
          backgroundColor: 'var(--color-light-blue)',
          color: 'var(--color-deep-blue)',
          border: '1px solid var(--color-light-blue-border)',
          backdropFilter: 'blur(8px)',
          boxShadow: 'var(--shadow-sm)',
        }
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: 'var(--color-deep-blue)',
          border: '1.5px solid var(--color-primary-blue)',
          boxShadow: 'var(--shadow-sm)',
        }
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: 'var(--color-text-main)',
          border: '1px solid transparent',
        }
      case 'danger':
        return {
          background: 'linear-gradient(135deg, var(--color-error) 0%, #991b1b 100%)',
          color: '#ffffff',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
        }
    }
  }

  // Styles based on size
  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return {
          padding: '6px 12px',
          fontSize: '0.875rem',
          minHeight: '36px',
        }
      case 'lg':
        return {
          padding: '14px 28px',
          fontSize: '1.125rem',
          minHeight: '52px',
        }
      case 'md':
      default:
        return {
          padding: '10px 20px',
          fontSize: '1rem',
          minHeight: '44px', // WCAG target minimum
        }
    }
  }

  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily: 'var(--font-family-base)',
    fontWeight: 600,
    borderRadius: 'var(--radius-md)',
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled || isLoading ? 0.6 : 1,
    transition: 'background var(--transition-fast), background-color var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast)',
    textDecoration: 'none',
    boxSizing: 'border-box',
    letterSpacing: '0.01em',
    lineHeight: 1.2,
    ...getVariantStyles(),
    ...getSizeStyles(),
    ...style,
  }

  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      style={baseStyles}
      className={`gazemouse-btn ${className}`}
    >
      {isLoading ? (
        <span aria-hidden="true" style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>
          ⟳
        </span>
      ) : (
        icon && iconPosition === 'left' && <span aria-hidden="true">{icon}</span>
      )}
      <span>{children}</span>
      {!isLoading && icon && iconPosition === 'right' && <span aria-hidden="true">{icon}</span>}
    </button>
  )
}

import React from 'react'

export interface AlertProps {
  type: 'info' | 'warning' | 'error' | 'success'
  title?: string
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export const Alert: React.FC<AlertProps> = ({
  type,
  title,
  children,
  action,
  className = '',
}) => {
  const getAlertStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'var(--color-success-bg)',
          border: 'var(--color-success-border)',
          color: 'var(--color-success)',
          icon: '✓',
        }
      case 'warning':
        return {
          bg: 'var(--color-warning-bg)',
          border: 'var(--color-warning-border)',
          color: 'var(--color-warning)',
          icon: '⚠',
        }
      case 'error':
        return {
          bg: 'var(--color-error-bg)',
          border: 'var(--color-error-border)',
          color: 'var(--color-error)',
          icon: '✕',
        }
      case 'info':
      default:
        return {
          bg: 'var(--color-info-bg)',
          border: 'var(--color-info-border)',
          color: 'var(--color-info)',
          icon: 'ℹ',
        }
    }
  }

  const { bg, border, color, icon } = getAlertStyles()

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      style={{
        backgroundColor: bg,
        border: `1px solid ${border}`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 'var(--radius-md)',
        padding: '16px',
        display: 'flex',
        gap: '14px',
        alignItems: 'flex-start',
        marginBottom: '16px',
        backdropFilter: 'blur(8px)',
        boxShadow: 'var(--shadow-sm)',
        fontFamily: 'var(--font-family-base)',
      }}
      className={`gazemouse-alert ${className}`}
    >
      <div
        aria-hidden="true"
        style={{
          color: color,
          fontSize: '1.15rem',
          fontWeight: 800,
          lineHeight: 1,
          marginTop: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '24px',
          height: '24px',
          filter: 'drop-shadow(0 0 2px currentColor)',
        }}
      >
        {icon}
      </div>

      <div style={{ flex: 1 }}>
        {title && (
          <h4
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: color,
              marginBottom: '4px',
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h4>
        )}
        <div style={{ fontSize: '0.9rem', color: 'var(--color-text-main)', lineHeight: 1.5 }}>
          {children}
        </div>
      </div>

      {action && <div>{action}</div>}
    </div>
  )
}

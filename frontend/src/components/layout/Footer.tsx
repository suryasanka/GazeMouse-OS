import React from 'react'
import type { PageId } from '../../types/navigation'

interface FooterProps {
  onNavigate: (page: PageId) => void
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer
      className="app-footer"
      style={{
        marginTop: 'auto',
        backgroundColor: 'var(--color-bg-surface-elevated)',
        borderTop: '1px solid var(--color-border)',
        padding: 'var(--space-2xl) var(--space-lg)',
        color: 'var(--color-text-secondary)',
        fontSize: '0.875rem',
      }}
    >
      <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '24px',
          }}
        >
          {/* Project summary */}
          <div style={{ maxWidth: '420px' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--color-deep-blue)', marginBottom: '8px' }}>
              GazeMouse-OS
            </h3>
            <p style={{ lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
              An accessibility-focused academic web application demonstrating browser-side computer-vision interaction for players with upper-limb motor differences.
            </p>
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-success)',
                }}
              />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-success)' }}>
                100% On-Device Processing (No Video Stream Leaves Browser)
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div style={{ display: 'flex', gap: '48px', flexWrap: 'wrap' }}>
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '12px' }}>
                Navigation
              </h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>
                  <button type="button" onClick={() => onNavigate('home')} className="footer-nav-link">
                    Home
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('games')} className="footer-nav-link">
                    Games Catalog
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('setup')} className="footer-nav-link">
                    Camera Setup & Calibration
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('how-it-works')} className="footer-nav-link">
                    Vision Pipeline
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '12px' }}>
                Assistance & Trust
              </h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>
                  <button type="button" onClick={() => onNavigate('accessibility')} className="footer-nav-link">
                    Accessibility Statement & WCAG
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('help')} className="footer-nav-link">
                    Help & Troubleshooting
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('settings')} className="footer-nav-link">
                    User Preferences
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Coursework & License row */}
        <div
          style={{
            borderTop: '1px solid var(--color-border-subtle)',
            paddingTop: '16px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            fontSize: '0.8rem',
            color: 'var(--color-text-muted)',
          }}
        >
          <span>GazeMouse-OS © 2026 — Demonstrable University Academic Project (Java Coursework)</span>
          <span>Zero Paid APIs • Local Execution • Privacy by Design Architecture</span>
        </div>
      </div>
    </footer>
  )
}

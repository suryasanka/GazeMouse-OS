import React, { useState, useEffect, useRef } from 'react'
import './LandingPage.css'

interface LandingPageProps {
  onLaunchApp: () => void
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchApp }) => {
  // Navigation states
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [gameFilter, setGameFilter] = useState<'all' | 'builtin' | '3d' | 'bridge'>('all')
  const [selectedModal, setSelectedModal] = useState<'runner' | 'match' | 'runner3d' | 'bridge' | null>(null)

  // Simulator telemetry states
  const simCanvasRef = useRef<HTMLDivElement>(null)
  const [simCoords, setSimCoords] = useState({ deltaX: 0, deltaY: 0 })
  const [simGesture, setSimGesture] = useState('NEUTRAL CENTER')
  const [isTurning, setIsTurning] = useState(false)
  const [pointerPos, setPointerPos] = useState({ x: 50, y: 50 })

  // Handle sticky navbar scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Interactive Simulator physics & gestures
  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!simCanvasRef.current) return
    const rect = simCanvasRef.current.getBoundingClientRect()
    const pointerX = clientX - rect.left
    const pointerY = clientY - rect.top

    const normX = ((pointerX / rect.width) - 0.5) * 2
    const normY = ((pointerY / rect.height) - 0.5) * 2

    const clampedX = Math.max(-1, Math.min(1, normX))
    const clampedY = Math.max(-1, Math.min(1, normY))

    const pixelPercentX = ((clampedX / 2) + 0.5) * 100
    const pixelPercentY = ((clampedY / 2) + 0.5) * 100

    setPointerPos({ x: pixelPercentX, y: pixelPercentY })
    setSimCoords({ deltaX: clampedX, deltaY: clampedY })

    const distance = Math.hypot(clampedX, clampedY)
    const deadZone = 0.16
    const threshold = 0.32

    if (distance < deadZone) {
      setSimGesture('NEUTRAL (IN DEADZONE)')
      setIsTurning(false)
    } else if (Math.abs(clampedX) > Math.abs(clampedY) * 0.8) {
      if (clampedX < -threshold) {
        setSimGesture('ACTION: TURN LEFT')
        setIsTurning(true)
      } else if (clampedX > threshold) {
        setSimGesture('ACTION: TURN RIGHT')
        setIsTurning(true)
      } else {
        setSimGesture(clampedX < 0 ? 'SUBTLE LEFT (IN SENSITIVITY BAND)' : 'SUBTLE RIGHT (IN SENSITIVITY BAND)')
        setIsTurning(false)
      }
    } else {
      if (clampedY < -threshold) {
        setSimGesture('ACTION: PITCH UP (JUMP)')
        setIsTurning(true)
      } else if (clampedY > threshold) {
        setSimGesture('ACTION: PITCH DOWN (CROUCH)')
        setIsTurning(true)
      } else {
        setSimGesture(clampedY < 0 ? 'LOOKING UP' : 'LOOKING DOWN')
        setIsTurning(false)
      }
    }
  }

  const handlePointerLeave = () => {
    setPointerPos({ x: 50, y: 50 })
    setSimCoords({ deltaX: 0, deltaY: 0 })
    setSimGesture('NEUTRAL CENTER')
    setIsTurning(false)
  }

  // Smooth scroll handler
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    setMobileMenuOpen(false)
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="landing-page-root">
      {/* ====================================================================
          Navigation Bar
          ==================================================================== */}
      <header className={`lp-navbar ${isScrolled ? 'scrolled' : ''}`} role="banner">
        <div className="lp-container lp-navbar-container">
          <div 
            className="lp-brand-link" 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="GazeMouse-OS Home"
          >
            <img 
              src="/landing-assets/logo.svg" 
              alt="GazeMouse-OS Emblem" 
              className="lp-brand-logo-img" 
              width="36" 
              height="36" 
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="lp-brand-title">GazeMouse-OS</span>
              <span className="lp-brand-tag">Assistive Gaming Tech</span>
            </div>
          </div>

          <nav className="lp-nav-menu" aria-label="Landing Page Navigation">
            <a href="#features" className="lp-nav-link" onClick={(e) => scrollToSection(e, 'features')}>Features</a>
            <a href="#how-it-works" className="lp-nav-link" onClick={(e) => scrollToSection(e, 'how-it-works')}>How It Works</a>
            <a href="#games" className="lp-nav-link" onClick={(e) => scrollToSection(e, 'games')}>Games</a>
            <a href="#privacy" className="lp-nav-link" onClick={(e) => scrollToSection(e, 'privacy')}>Privacy & Safety</a>
          </nav>

          <div className="lp-nav-actions">
            <button 
              type="button" 
              className="lp-btn lp-btn-primary lp-btn-sm lp-desktop-cta"
              onClick={onLaunchApp}
            >
              Launch App
            </button>
            <button 
              type="button" 
              className="lp-mobile-toggle"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span style={{ fontSize: '1.4rem' }}>☰</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <div className={`lp-mobile-drawer ${mobileMenuOpen ? 'open' : ''}`}>
        <a href="#features" className="lp-nav-link" onClick={(e) => scrollToSection(e, 'features')}>Features</a>
        <a href="#how-it-works" className="lp-nav-link" onClick={(e) => scrollToSection(e, 'how-it-works')}>How It Works</a>
        <a href="#games" className="lp-nav-link" onClick={(e) => scrollToSection(e, 'games')}>Games</a>
        <a href="#privacy" className="lp-nav-link" onClick={(e) => scrollToSection(e, 'privacy')}>Privacy & Safety</a>
        <button 
          type="button" 
          className="lp-btn lp-btn-primary"
          style={{ marginTop: '10px' }}
          onClick={() => {
            setMobileMenuOpen(false)
            onLaunchApp()
          }}
        >
          Launch App
        </button>
      </div>

      {/* ====================================================================
          Hero Section
          ==================================================================== */}
      <section id="hero" className="lp-hero-section">
        <div className="lp-container">
          <div className="lp-hero-grid">
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <div className="lp-section-label">
                <span className="lp-dot"></span> Next-Gen Assistive Gaming
              </div>

              <h1 className="lp-hero-headline">
                Your Head. <br />
                Your Moves. <br />
                <span className="lp-gradient-text">Your Game.</span>
              </h1>

              <p className="lp-hero-subtitle">
                Experience a new way to play. GazeMouse-OS transforms natural head movements into controls for supported games, helping make gaming more accessible.
              </p>

              <div className="lp-hero-ctas">
                <button 
                  type="button" 
                  className="lp-btn lp-btn-primary lp-btn-lg"
                  onClick={onLaunchApp}
                >
                  Get Started
                </button>
                <a 
                  href="#how-it-works" 
                  className="lp-btn lp-btn-secondary lp-btn-lg"
                  onClick={(e) => scrollToSection(e, 'how-it-works')}
                >
                  See How It Works
                </a>
              </div>

              <div className="lp-hero-badges-row">
                <div className="lp-tech-pill">
                  <span style={{ color: 'var(--lp-accent-cyan)' }}>⚡</span> 100% On-Device Inference
                </div>
                <div className="lp-tech-pill">
                  <span style={{ color: 'var(--lp-accent-cyan)' }}>🔒</span> Zero Video Transmission
                </div>
                <div className="lp-tech-pill">
                  <span style={{ color: 'var(--lp-accent-cyan)' }}>🎯</span> Standard Webcam Ready
                </div>
              </div>
            </div>

            {/* Hero Visual Card */}
            <div className="lp-visual-wrapper">
              <div className="lp-visual-card">
                <img 
                  src="/landing-assets/hero_gaming_setup.jpg" 
                  alt="Cinematic gaming setup showing curved monitor with facial landmark tracking visualization" 
                  className="lp-main-img"
                  width="1280"
                  height="720"
                />

                <div className="lp-hud-tag">
                  <span className="lp-hud-pulse"></span>
                  <span>VISION PIPELINE · 478 LANDMARKS</span>
                </div>

                <div className="lp-hud-telemetry">
                  <div className="lp-telemetry-item">
                    <span className="lp-telemetry-label">Head Yaw</span>
                    <span className="lp-telemetry-val highlight">
                      {simCoords.deltaX >= 0 ? `+${(simCoords.deltaX * 28).toFixed(1)}°` : `${(simCoords.deltaX * 28).toFixed(1)}°`}
                    </span>
                  </div>
                  <div className="lp-telemetry-item">
                    <span className="lp-telemetry-label">Head Pitch</span>
                    <span className="lp-telemetry-val highlight">
                      {simCoords.deltaY <= 0 ? `+${(simCoords.deltaY * -22).toFixed(1)}°` : `${(simCoords.deltaY * -22).toFixed(1)}°`}
                    </span>
                  </div>
                  <div className="lp-telemetry-item">
                    <span className="lp-telemetry-label">Tracker State</span>
                    <span className="lp-telemetry-val">
                      {isTurning ? simGesture.replace('ACTION: ', '') : 'TRACKING STABLE'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ====================================================================
          Interactive Optical Simulator Strip
          ==================================================================== */}
      <section className="lp-simulator-strip" aria-label="Interactive Head Tracking Simulator">
        <div className="lp-container">
          <div className="lp-simulator-card">
            
            <div>
              <div className="lp-section-label">
                <span className="lp-dot"></span> Interactive Optical Simulator
              </div>
              <h3 style={{ fontSize: '1.6rem', marginBottom: '0.5rem', color: '#ffffff' }}>
                Test the Biomechanical Tracking Logic
              </h3>
              <p style={{ color: 'var(--lp-text-secondary)', fontSize: '0.95rem', marginBottom: '1rem', lineHeight: 1.6 }}>
                Move your cursor or touch inside the virtual viewfinder to simulate natural head movement. Observe how neutral calibration, dead-zone isolation, and intentional directional thresholding operate in real time.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem', color: 'var(--lp-text-secondary)' }}>
                <div>✓ <strong>Dead-Zone Stabilization:</strong> Suppresses involuntary tremors and resting jitter.</div>
                <div>✓ <strong>Hysteresis Cooldown:</strong> Enforces return-to-center before re-triggering actions.</div>
              </div>
            </div>

            <div style={{ background: '#040711', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '18px', padding: '16px' }}>
              <div 
                ref={simCanvasRef}
                className="lp-sim-canvas"
                onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
                onMouseLeave={handlePointerLeave}
                onTouchMove={(e) => {
                  if (e.touches.length > 0) {
                    handlePointerMove(e.touches[0].clientX, e.touches[0].clientY)
                  }
                }}
                onTouchEnd={handlePointerLeave}
                role="region"
                aria-label="Interactive head tracking radar preview"
              >
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(56, 189, 248, 0.15)' }} />
                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: 'rgba(56, 189, 248, 0.15)' }} />
                
                <div className="lp-sim-deadzone">DEADZONE</div>

                <div 
                  className="lp-sim-pointer"
                  style={{ left: `${pointerPos.x}%`, top: `${pointerPos.y}%` }}
                >
                  <div className="lp-sim-pointer-ring" />
                  <div className="lp-sim-pointer-center" />
                </div>
              </div>

              <div className="lp-sim-status">
                <span style={{ color: 'var(--lp-text-muted)' }}>
                  ΔX: {simCoords.deltaX >= 0 ? '+' : ''}{simCoords.deltaX.toFixed(2)} | ΔY: {simCoords.deltaY >= 0 ? '+' : ''}{simCoords.deltaY.toFixed(2)}
                </span>
                <span className={`lp-sim-badge ${isTurning ? 'turning' : ''}`}>
                  {simGesture}
                </span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ====================================================================
          How It Works Section
          ==================================================================== */}
      <section id="how-it-works" className="lp-how-section">
        <div className="lp-container">
          
          <div className="lp-section-header">
            <div className="lp-section-label">
              <span className="lp-dot"></span> Architecture & Pipeline
            </div>
            <h2>How GazeMouse-OS Works</h2>
            <p>
              From raw webcam frames to responsive game inputs — a refined three-stage optical pipeline operating entirely within your browser.
            </p>
          </div>

          <div className="lp-steps-container">
            {/* Step 01 */}
            <article className="lp-step-card">
              <div className="lp-step-badge">01</div>
              <h3 style={{ fontSize: '1.45rem', marginBottom: '0.8rem', color: '#ffffff' }}>Detect</h3>
              <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--lp-accent-cyan)', marginBottom: '0.8rem' }}>
                The webcam detects facial landmarks to support head tracking.
              </p>
              <p style={{ fontSize: '0.92rem', color: 'var(--lp-text-secondary)', lineHeight: 1.6 }}>
                Using the browser's local <code>getUserMedia</code> API and Google MediaPipe Face Landmarker via WebAssembly and WebGL, the system detects 478 3D facial landmarks at 30 to 60 FPS without streaming video.
              </p>
            </article>

            {/* Step 02 */}
            <article className="lp-step-card">
              <div className="lp-step-badge">02</div>
              <h3 style={{ fontSize: '1.45rem', marginBottom: '0.8rem', color: '#ffffff' }}>Interpret</h3>
              <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--lp-accent-cyan)', marginBottom: '0.8rem' }}>
                The application interprets head movements and recognizes supported directional gestures.
              </p>
              <p style={{ fontSize: '0.92rem', color: 'var(--lp-text-secondary)', lineHeight: 1.6 }}>
                Relative displacement vectors (ΔX, ΔY) are calculated against the player's personal neutral baseline, filtered by an exponential moving average and hysteresis cooldown to prevent accidental activations.
              </p>
            </article>

            {/* Step 03 */}
            <article className="lp-step-card">
              <div className="lp-step-badge">03</div>
              <h3 style={{ fontSize: '1.45rem', marginBottom: '0.8rem', color: '#ffffff' }}>Play</h3>
              <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--lp-accent-cyan)', marginBottom: '0.8rem' }}>
                Recognized gestures can control compatible games through the relevant input mechanism.
              </p>
              <p style={{ fontSize: '0.92rem', color: 'var(--lp-text-secondary)', lineHeight: 1.6 }}>
                Filtered gestures trigger game actions: steering lanes in 2D/3D endless runners, controlling floating dwell cursors in puzzle grids, or dispatching DirectInput scancodes to external game windows via loopback bridge.
              </p>
            </article>
          </div>

        </div>
      </section>

      {/* ====================================================================
          Features Section (6 Cards)
          ==================================================================== */}
      <section id="features" style={{ padding: '5rem 0' }}>
        <div className="lp-container">
          
          <div className="lp-section-header">
            <div className="lp-section-label">
              <span className="lp-dot"></span> Core Capabilities
            </div>
            <h2>Engineered for Freedom & Precision</h2>
            <p>
              High-performance assistive technology designed to make gaming accessible through comfortable, customizable head interaction.
            </p>
          </div>

          <div className="lp-features-grid">
            <article className="lp-feature-card">
              <div className="lp-feature-icon">👁️</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#ffffff' }}>Real-Time Face & Head Tracking</h3>
              <p style={{ fontSize: '0.93rem', color: 'var(--lp-text-secondary)', lineHeight: 1.6 }}>
                478 3D landmarks estimated locally via WebAssembly and WebGL at 30–60 FPS. Operates on standard laptop webcams without expensive proprietary eye trackers.
              </p>
            </article>

            <article className="lp-feature-card">
              <div className="lp-feature-icon">🎯</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#ffffff' }}>Center Calibration</h3>
              <p style={{ fontSize: '0.93rem', color: 'var(--lp-text-secondary)', lineHeight: 1.6 }}>
                Zero your resting head posture with a single click. Accommodates any seating position, wheelchair posture, or camera tilt without requiring unnatural angles.
              </p>
            </article>

            <article className="lp-feature-card">
              <div className="lp-feature-icon">⚡</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#ffffff' }}>Directional Gesture Recognition</h3>
              <p style={{ fontSize: '0.93rem', color: 'var(--lp-text-secondary)', lineHeight: 1.6 }}>
                Robust classifiers translate yaw (lateral turns) and pitch (vertical deflections) into discrete keystroke actions, with hysteresis to prevent double triggers.
              </p>
            </article>

            <article className="lp-feature-card">
              <div className="lp-feature-icon">🎮</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#ffffff' }}>Hands-Free Gaming Controls</h3>
              <p style={{ fontSize: '0.93rem', color: 'var(--lp-text-secondary)', lineHeight: 1.6 }}>
                Designed specifically for gamers with limited motor or upper-limb mobility. Play high-speed runner and puzzle games completely hands-free.
              </p>
            </article>

            <article className="lp-feature-card">
              <div className="lp-feature-icon">🌉</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#ffffff' }}>Desktop Input Bridge</h3>
              <p style={{ fontSize: '0.93rem', color: 'var(--lp-text-secondary)', lineHeight: 1.6 }}>
                Standalone Python 3 Windows daemon injecting Win32 DirectInput scancodes over loopback WebSocket with cryptographic token isolation and hardware E-Stop.
              </p>
            </article>

            <article className="lp-feature-card">
              <div className="lp-feature-icon">♿</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#ffffff' }}>Accessibility-Focused Interaction</h3>
              <p style={{ fontSize: '0.93rem', color: 'var(--lp-text-secondary)', lineHeight: 1.6 }}>
                WCAG AA compliant contrast, visible keyboard focus indicators, auto-pause on face loss, adjustable dead-zones, and universal keyboard fallbacks.
              </p>
            </article>
          </div>

        </div>
      </section>

      {/* ====================================================================
          Games Showcase Section (Accurate & Verified)
          ==================================================================== */}
      <section id="games" style={{ padding: '5rem 0' }}>
        <div className="lp-container">
          
          <div className="lp-section-header">
            <div className="lp-section-label">
              <span className="lp-dot"></span> Verified Game Catalog
            </div>
            <h2>Supported Gaming Experiences</h2>
            <p>
              Choose from verified original games running directly inside the app, or inspect the desktop bridge for external games.
            </p>
          </div>

          <div className="lp-games-tabs">
            <button 
              type="button" 
              className={`lp-filter-tab ${gameFilter === 'all' ? 'active' : ''}`}
              onClick={() => setGameFilter('all')}
            >
              All Titles
            </button>
            <button 
              type="button" 
              className={`lp-filter-tab ${gameFilter === 'builtin' ? 'active' : ''}`}
              onClick={() => setGameFilter('builtin')}
            >
              Built-In Web Games
            </button>
            <button 
              type="button" 
              className={`lp-filter-tab ${gameFilter === '3d' ? 'active' : ''}`}
              onClick={() => setGameFilter('3d')}
            >
              3D WebGL
            </button>
            <button 
              type="button" 
              className={`lp-filter-tab ${gameFilter === 'bridge' ? 'active' : ''}`}
              onClick={() => setGameFilter('bridge')}
            >
              Desktop Bridge (External)
            </button>
          </div>

          <div className="lp-games-grid">
            {/* Game 1: Gaze Runner */}
            {(gameFilter === 'all' || gameFilter === 'builtin') && (
              <article className="lp-game-card">
                <div className="lp-game-banner" style={{ background: 'linear-gradient(135deg, #091e3a 0%, #034078 60%, #001220 100%)' }}>
                  <span>🏃💨</span>
                </div>
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '1.4rem', color: '#ffffff' }}>Gaze Runner</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--lp-accent-cyan)' }}>2D Canvas</span>
                  </div>
                  <p style={{ fontSize: '0.93rem', color: 'var(--lp-text-secondary)', marginBottom: '1rem', lineHeight: 1.6 }}>
                    Original 3-lane endless runner. Shift lanes with gentle lateral head turns, avoid static hurdles, and collect tokens.
                  </p>
                  <div className="lp-game-spec-grid">
                    <div>
                      <span className="lp-spec-label">Input:</span>
                      <div className="lp-spec-val">Lateral Yaw (ΔX)</div>
                    </div>
                    <div>
                      <span className="lp-spec-label">Safeguard:</span>
                      <div className="lp-spec-val">Auto-Pause on Face Loss</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                    <button 
                      type="button" 
                      className="lp-btn lp-btn-primary lp-btn-sm" 
                      style={{ flex: 1.2 }}
                      onClick={onLaunchApp}
                    >
                      Play in App
                    </button>
                    <button 
                      type="button" 
                      className="lp-btn lp-btn-secondary lp-btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => setSelectedModal('runner')}
                    >
                      Specs
                    </button>
                  </div>
                </div>
              </article>
            )}

            {/* Game 2: Gaze Match */}
            {(gameFilter === 'all' || gameFilter === 'builtin') && (
              <article className="lp-game-card">
                <div className="lp-game-banner" style={{ background: 'linear-gradient(135deg, #2b0938 0%, #6b21a8 60%, #150520 100%)' }}>
                  <span>🧩✨</span>
                </div>
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '1.4rem', color: '#ffffff' }}>Gaze Match</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--lp-accent-cyan)' }}>Match-3 Puzzle</span>
                  </div>
                  <p style={{ fontSize: '0.93rem', color: 'var(--lp-text-secondary)', marginBottom: '1rem', lineHeight: 1.6 }}>
                    8x8 match-3 grid. Steer a floating virtual pointer with head movements, dwell-select gems, and swap neighbors.
                  </p>
                  <div className="lp-game-spec-grid">
                    <div>
                      <span className="lp-spec-label">Input:</span>
                      <div className="lp-spec-val">Cursor + Dwell (800ms)</div>
                    </div>
                    <div>
                      <span className="lp-spec-label">A11y:</span>
                      <div className="lp-spec-val">Colorblind Symbols</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                    <button 
                      type="button" 
                      className="lp-btn lp-btn-primary lp-btn-sm" 
                      style={{ flex: 1.2 }}
                      onClick={onLaunchApp}
                    >
                      Play in App
                    </button>
                    <button 
                      type="button" 
                      className="lp-btn lp-btn-secondary lp-btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => setSelectedModal('match')}
                    >
                      Specs
                    </button>
                  </div>
                </div>
              </article>
            )}

            {/* Game 3: Gaze 3D Runner */}
            {(gameFilter === 'all' || gameFilter === '3d') && (
              <article className="lp-game-card">
                <div className="lp-game-banner" style={{ background: 'linear-gradient(135deg, #051622 0%, #0891b2 60%, #022c36 100%)' }}>
                  <span>🚅⚡</span>
                </div>
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '1.4rem', color: '#ffffff' }}>Gaze 3D Runner</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--lp-accent-cyan)' }}>Three.js 3D WebGL</span>
                  </div>
                  <p style={{ fontSize: '0.93rem', color: 'var(--lp-text-secondary)', marginBottom: '1rem', lineHeight: 1.6 }}>
                    Cyber subway runner. Shift across three perspective tracks, jump barriers, and dodge transit pods with guaranteed safe routes.
                  </p>
                  <div className="lp-game-spec-grid">
                    <div>
                      <span className="lp-spec-label">Input:</span>
                      <div className="lp-spec-val">Yaw + Pitch Jump</div>
                    </div>
                    <div>
                      <span className="lp-spec-label">Safe Path:</span>
                      <div className="lp-spec-val">1+ Open Lane Always</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                    <button 
                      type="button" 
                      className="lp-btn lp-btn-primary lp-btn-sm" 
                      style={{ flex: 1.2 }}
                      onClick={onLaunchApp}
                    >
                      Play in App
                    </button>
                    <button 
                      type="button" 
                      className="lp-btn lp-btn-secondary lp-btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => setSelectedModal('runner3d')}
                    >
                      Specs
                    </button>
                  </div>
                </div>
              </article>
            )}

            {/* Game 4: Subway Surfers Bridge */}
            {(gameFilter === 'all' || gameFilter === 'bridge') && (
              <article className="lp-game-card">
                <div className="lp-game-banner" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #3730a3 60%, #0f172a 100%)' }}>
                  <span>🛹🚇</span>
                </div>
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '1.4rem', color: '#ffffff' }}>Subway Surfers</h3>
                    <span style={{ fontSize: '0.75rem', color: '#a5b4fc' }}>Desktop Bridge</span>
                  </div>
                  <p style={{ fontSize: '0.93rem', color: 'var(--lp-text-secondary)', marginBottom: '1rem', lineHeight: 1.6 }}>
                    Python desktop bridge injecting DirectInput scancodes over loopback WebSocket to external Windows game windows.
                  </p>
                  <div style={{ fontSize: '0.8rem', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#fde68a', padding: '8px 10px', borderRadius: '8px', marginBottom: '1rem', lineHeight: 1.45 }}>
                    <strong>Research Status:</strong> Bridge socket, token handshake, and scancode injector are verified by 54 unit tests; browser focus routing is under active ongoing research.
                  </div>
                  <div className="lp-game-spec-grid">
                    <div>
                      <span className="lp-spec-label">Socket:</span>
                      <div className="lp-spec-val">ws://127.0.0.1:8765</div>
                    </div>
                    <div>
                      <span className="lp-spec-label">E-Stop:</span>
                      <div className="lp-spec-val">Ctrl+Alt+Q Hotkey</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                    <button 
                      type="button" 
                      className="lp-btn lp-btn-secondary lp-btn-sm"
                      style={{ width: '100%' }}
                      onClick={() => setSelectedModal('bridge')}
                    >
                      View Architecture Specs
                    </button>
                  </div>
                </div>
              </article>
            )}
          </div>

        </div>
      </section>

      {/* ====================================================================
          Privacy & Accessibility Section
          ==================================================================== */}
      <section id="privacy" style={{ padding: '5rem 0' }}>
        <div className="lp-container">
          
          <div className="lp-privacy-grid">
            <div className="lp-privacy-card">
              <div className="lp-section-label">
                <span className="lp-dot"></span> Uncompromising Privacy
              </div>
              <h2 style={{ fontSize: '1.8rem', marginBottom: '1rem', color: '#ffffff' }}>Zero Video Leaves Your Machine</h2>
              <p style={{ fontSize: '1.05rem', color: 'var(--lp-text-secondary)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
                GazeMouse-OS is engineered around strict local privacy principles. Your camera stream is processed purely in client memory and is never uploaded, recorded, or transmitted to any external server.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.93rem', color: 'var(--lp-text-secondary)' }}>
                <div>🔒 <strong>100% On-Device WebAssembly Inference:</strong> Landmark coordinates are calculated locally in browser RAM.</div>
                <div>🔒 <strong>Explicit Browser Permissions & No Accounts:</strong> No user registration, telemetry trackers, or third-party cookies.</div>
                <div>🔒 <strong>Hardware Emergency Stop:</strong> Pressing <code>Ctrl + Alt + Q</code> anywhere immediately halts all desktop key injection.</div>
              </div>
            </div>

            <div className="lp-privacy-card">
              <div className="lp-section-label">
                <span className="lp-dot"></span> Inclusive Design
              </div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#ffffff' }}>Accessibility Highlights</h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.92rem', color: 'var(--lp-text-secondary)' }}>
                <li>✓ <strong>High-Contrast Aesthetics:</strong> Exceeds 4.5:1 WCAG AA contrast ratio across all UI elements.</li>
                <li>✓ <strong>Visible Keyboard Focus:</strong> Clean focus indicators on all interactive controls for keyboard-only navigation.</li>
                <li>✓ <strong>Reduced Motion Support:</strong> Respects <code>prefers-reduced-motion</code> system preferences.</li>
                <li>✓ <strong>Adjustable Dead-Zones:</strong> Fine-tune resting sensitivity to match personal comfort and eliminate fatigue.</li>
                <li>✓ <strong>Auto-Pause Protection:</strong> Games freeze automatically if your face moves outside webcam view.</li>
              </ul>
            </div>
          </div>

        </div>
      </section>

      {/* ====================================================================
          Final Call To Action
          ==================================================================== */}
      <section style={{ padding: '5rem 0' }}>
        <div className="lp-container">
          <div className="lp-cta-box">
            <div className="lp-section-label" style={{ marginBottom: '1rem' }}>
              <span className="lp-dot"></span> Open Access Initiative
            </div>
            <h2 style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.2rem)', marginBottom: '1rem', color: '#ffffff' }}>
              Ready to Experience Gaming Differently?
            </h2>
            <p style={{ fontSize: '1.15rem', color: 'var(--lp-text-secondary)', maxWidth: '620px', margin: '0 auto 2rem auto', lineHeight: 1.6 }}>
              Discover a hands-free approach to gaming with GazeMouse-OS.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <button 
                type="button" 
                className="lp-btn lp-btn-glow lp-btn-lg"
                onClick={onLaunchApp}
              >
                Launch GazeMouse-OS App
              </button>
              <a 
                href="#how-it-works" 
                className="lp-btn lp-btn-secondary lp-btn-lg"
                onClick={(e) => scrollToSection(e, 'how-it-works')}
              >
                Review Technical Pipeline
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          Footer
          ==================================================================== */}
      <footer className="lp-footer" role="contentinfo">
        <div className="lp-container">
          <div className="lp-footer-top">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <img src="/landing-assets/logo.svg" alt="GazeMouse-OS" width="30" height="30" style={{ borderRadius: '6px' }} />
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>GazeMouse-OS</span>
              </div>
              <p style={{ color: 'var(--lp-text-secondary)', maxWidth: '380px', lineHeight: 1.6, fontSize: '0.9rem' }}>
                An accessibility-first gaming and assistive-control system designed to empower players with limited upper-limb mobility to play games using comfortable head gestures.
              </p>
            </div>

            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', marginBottom: '1rem' }}>Navigation</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><a href="#hero" className="lp-nav-link" onClick={(e) => scrollToSection(e, 'hero')}>Overview</a></li>
                <li><a href="#features" className="lp-nav-link" onClick={(e) => scrollToSection(e, 'features')}>Features</a></li>
                <li><a href="#how-it-works" className="lp-nav-link" onClick={(e) => scrollToSection(e, 'how-it-works')}>How It Works</a></li>
                <li><a href="#games" className="lp-nav-link" onClick={(e) => scrollToSection(e, 'games')}>Games Catalog</a></li>
                <li><a href="#privacy" className="lp-nav-link" onClick={(e) => scrollToSection(e, 'privacy')}>Privacy & Safety</a></li>
              </ul>
            </div>

            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', marginBottom: '1rem' }}>Architecture</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--lp-text-muted)' }}>
                <li>MediaPipe Face Vision</li>
                <li>WebAssembly & WebGL</li>
                <li>HTML5 Canvas & Three.js</li>
                <li>Python 3 Desktop Bridge</li>
                <li>Ctrl+Alt+Q Emergency Stop</li>
              </ul>
            </div>
          </div>

          <div style={{ paddingTop: '2rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>&copy; 2026 GazeMouse-OS Project. Developed with an accessibility-first mindset.</div>
            <div style={{ display: 'flex', gap: '10px', fontSize: '0.78rem', fontFamily: 'var(--lp-font-mono)' }}>
              <span style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '4px 8px', borderRadius: '4px' }}>React 19 / Vite</span>
              <span style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '4px 8px', borderRadius: '4px' }}>Google MediaPipe</span>
              <span style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '4px 8px', borderRadius: '4px' }}>Three.js</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Modal Dialog for Specifications */}
      {selectedModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3, 5, 10, 0.85)',
            backdropFilter: 'blur(10px)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setSelectedModal(null)}
          role="dialog"
          aria-modal="true"
        >
          <div 
            style={{
              background: 'var(--lp-bg-surface-elevated)',
              border: '1px solid var(--lp-border-card-hover)',
              borderRadius: '24px',
              maxWidth: '580px',
              width: '100%',
              padding: '2rem',
              position: 'relative',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              type="button" 
              onClick={() => setSelectedModal(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#ffffff',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '1.2rem',
              }}
              aria-label="Close specifications dialog"
            >
              &times;
            </button>

            {selectedModal === 'runner' && (
              <>
                <h3 style={{ fontSize: '1.4rem', color: '#ffffff', marginBottom: '8px' }}>Gaze Runner Specifications</h3>
                <p style={{ color: 'var(--lp-text-secondary)', fontSize: '0.92rem', marginBottom: '16px', lineHeight: 1.5 }}>
                  HTML5 Canvas 2D endless runner engineered for low cognitive load lateral yaw steering.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
                  <div><strong>Primary Input:</strong> Lateral Head Turns (Yaw ΔX)</div>
                  <div><strong>Engine:</strong> HTML5 Canvas 2D @ 60 FPS</div>
                  <div><strong>Safeguards:</strong> Instant auto-pause upon face loss</div>
                  <div><strong>Keyboard Fallback:</strong> A / D or Arrow Keys</div>
                  <div><strong>Status:</strong> Verified & fully playable in GazeMouse-OS</div>
                </div>
              </>
            )}

            {selectedModal === 'match' && (
              <>
                <h3 style={{ fontSize: '1.4rem', color: '#ffffff', marginBottom: '8px' }}>Gaze Match Specifications</h3>
                <p style={{ color: 'var(--lp-text-secondary)', fontSize: '0.92rem', marginBottom: '16px', lineHeight: 1.5 }}>
                  Tactical 8x8 match-3 puzzle game designed for fine cursor steering and dwell-click holding.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
                  <div><strong>Primary Input:</strong> Virtual Head Cursor (ΔX, ΔY) + 800ms Dwell</div>
                  <div><strong>Engine:</strong> HTML5 Canvas 2D</div>
                  <div><strong>Colorblind Support:</strong> Distinct geometric glyphs & colors</div>
                  <div><strong>Keyboard Fallback:</strong> Arrow Keys + Spacebar</div>
                  <div><strong>Status:</strong> Verified & fully playable in GazeMouse-OS</div>
                </div>
              </>
            )}

            {selectedModal === 'runner3d' && (
              <>
                <h3 style={{ fontSize: '1.4rem', color: '#ffffff', marginBottom: '8px' }}>Gaze 3D Runner Specifications</h3>
                <p style={{ color: 'var(--lp-text-secondary)', fontSize: '0.92rem', marginBottom: '16px', lineHeight: 1.5 }}>
                  3D endless runner set on a Cyber Subway corridor with Three.js dynamic lighting.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
                  <div><strong>Primary Input:</strong> Lateral Turns + Upward Pitch Jump</div>
                  <div><strong>Engine:</strong> Vanilla Three.js WebGL</div>
                  <div><strong>Passage Algorithm:</strong> Guaranteed at least 1 open lane</div>
                  <div><strong>Keyboard Fallback:</strong> W / A / S / D or Arrow Keys</div>
                  <div><strong>Status:</strong> Verified & fully playable in GazeMouse-OS</div>
                </div>
              </>
            )}

            {selectedModal === 'bridge' && (
              <>
                <h3 style={{ fontSize: '1.4rem', color: '#ffffff', marginBottom: '8px' }}>Desktop Bridge Specifications</h3>
                <p style={{ color: 'var(--lp-text-secondary)', fontSize: '0.92rem', marginBottom: '16px', lineHeight: 1.5 }}>
                  Python 3 Windows daemon communicating via loopback WebSocket and Win32 DirectInput scancodes.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
                  <div><strong>Connection:</strong> ws://127.0.0.1:8765 (Loopback only)</div>
                  <div><strong>Security:</strong> Ephemeral cryptographically random token with NTFS user ACLs</div>
                  <div><strong>Safety Guard:</strong> Global hardware <code>Ctrl + Alt + Q</code> Emergency Stop</div>
                  <div><strong>Watchdog:</strong> Inactivity timeout disables input after 2.0s silence</div>
                  <div><strong>Research Status:</strong> Bridge daemon & input scancodes verified; in-game browser window key routing is under active ongoing research.</div>
                </div>
              </>
            )}

            <button 
              type="button" 
              className="lp-btn lp-btn-primary lp-btn-sm" 
              style={{ marginTop: '20px', width: '100%' }}
              onClick={() => setSelectedModal(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

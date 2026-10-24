/**
 * GazeMouse-OS — Premium Landing Page Interactive Logic
 * Zero-dependency, lightweight, WCAG accessible
 */

document.addEventListener('DOMContentLoaded', () => {
  // ------------------------------------------------------------------------
  // 1. Sticky Navigation & Scroll Spy
  // ------------------------------------------------------------------------
  const navbar = document.querySelector('.navbar');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section[id], header[id]');

  const handleScroll = () => {
    if (window.scrollY > 30) {
      navbar?.classList.add('scrolled');
    } else {
      navbar?.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // Scroll Spy using IntersectionObserver
  if ('IntersectionObserver' in window) {
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0
    };

    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const currentId = entry.target.getAttribute('id');
          navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === `#${currentId}`) {
              link.classList.add('active');
            } else {
              link.classList.remove('active');
            }
          });
        }
      });
    }, observerOptions);

    sections.forEach(section => sectionObserver.observe(section));
  }

  // ------------------------------------------------------------------------
  // 2. Mobile Menu Navigation Drawer
  // ------------------------------------------------------------------------
  const mobileToggle = document.querySelector('.mobile-toggle');
  const mobileDrawer = document.querySelector('.mobile-drawer');

  if (mobileToggle && mobileDrawer) {
    const toggleDrawer = (open) => {
      const isExpanded = open !== undefined ? open : mobileToggle.getAttribute('aria-expanded') !== 'true';
      mobileToggle.setAttribute('aria-expanded', String(isExpanded));
      if (isExpanded) {
        mobileDrawer.classList.add('open');
        document.body.style.overflow = 'hidden';
      } else {
        mobileDrawer.classList.remove('open');
        document.body.style.overflow = '';
      }
    };

    mobileToggle.addEventListener('click', () => toggleDrawer());

    // Close when clicking mobile links
    mobileDrawer.querySelectorAll('.nav-link, .btn').forEach(link => {
      link.addEventListener('click', () => toggleDrawer(false));
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileDrawer.classList.contains('open')) {
        toggleDrawer(false);
        mobileToggle.focus();
      }
    });
  }

  // ------------------------------------------------------------------------
  // 3. Interactive Head Tracking Simulator
  // ------------------------------------------------------------------------
  const simCanvas = document.querySelector('.sim-canvas-area');
  const simReticle = document.querySelector('.sim-pointer-reticle');
  const simCoords = document.querySelector('.sim-coords');
  const simStateBadge = document.querySelector('.sim-gesture-state');
  const heroYawVal = document.getElementById('hero-telemetry-yaw');
  const heroPitchVal = document.getElementById('hero-telemetry-pitch');
  const heroStateVal = document.getElementById('hero-telemetry-state');

  if (simCanvas && simReticle) {
    let animFrame = null;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const updatePhysics = () => {
      // Smooth lerp easing towards cursor position
      currentX += (targetX - currentX) * 0.25;
      currentY += (targetY - currentY) * 0.25;

      const rect = simCanvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Position in pixels relative to center
      const pixelX = centerX + currentX * (centerX * 0.85);
      const pixelY = centerY + currentY * (centerY * 0.85);

      simReticle.style.left = `${pixelX}px`;
      simReticle.style.top = `${pixelY}px`;

      // Telemetry calculations
      const deltaX = currentX;
      const deltaY = currentY;
      const distance = Math.hypot(deltaX, deltaY);

      const deadZoneRadius = 0.16; // 16% normalized deadzone
      const threshold = 0.32;

      let gesture = 'NEUTRAL CENTER';
      let isTurning = false;

      if (distance < deadZoneRadius) {
        gesture = 'NEUTRAL (IN DEADZONE)';
      } else if (Math.abs(deltaX) > Math.abs(deltaY) * 0.8) {
        if (deltaX < -threshold) {
          gesture = 'ACTION: TURN LEFT';
          isTurning = true;
        } else if (deltaX > threshold) {
          gesture = 'ACTION: TURN RIGHT';
          isTurning = true;
        } else {
          gesture = deltaX < 0 ? 'SUBTLE LEFT (BELOW THRESHOLD)' : 'SUBTLE RIGHT (BELOW THRESHOLD)';
        }
      } else {
        if (deltaY < -threshold) {
          gesture = 'ACTION: PITCH UP (JUMP)';
          isTurning = true;
        } else if (deltaY > threshold) {
          gesture = 'ACTION: PITCH DOWN (CROUCH)';
          isTurning = true;
        } else {
          gesture = deltaY < 0 ? 'LOOKING UP' : 'LOOKING DOWN';
        }
      }

      if (simCoords) {
        simCoords.textContent = `ΔX: ${deltaX >= 0 ? '+' : ''}${deltaX.toFixed(2)} | ΔY: ${deltaY >= 0 ? '+' : ''}${deltaY.toFixed(2)}`;
      }

      if (simStateBadge) {
        simStateBadge.textContent = gesture;
        if (isTurning) {
          simStateBadge.classList.add('turning');
        } else {
          simStateBadge.classList.remove('turning');
        }
      }

      // Sync with hero HUD telemetry if present
      if (heroYawVal) {
        heroYawVal.textContent = `${(deltaX * 28).toFixed(1)}°`;
      }
      if (heroPitchVal) {
        heroPitchVal.textContent = `${(deltaY * -22).toFixed(1)}°`;
      }
      if (heroStateVal) {
        heroStateVal.textContent = isTurning ? gesture.replace('ACTION: ', '') : 'TRACKING STABLE';
      }

      animFrame = requestAnimationFrame(updatePhysics);
    };

    const handlePointerMove = (e) => {
      const rect = simCanvas.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;

      const normX = ((pointerX / rect.width) - 0.5) * 2;
      const normY = ((pointerY / rect.height) - 0.5) * 2;

      targetX = Math.max(-1, Math.min(1, normX));
      targetY = Math.max(-1, Math.min(1, normY));
    };

    const handlePointerLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    simCanvas.addEventListener('mousemove', handlePointerMove);
    simCanvas.addEventListener('mouseleave', handlePointerLeave);

    // Touch support for mobile simulation
    simCanvas.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        e.preventDefault();
        const touch = e.touches[0];
        handlePointerMove({ clientX: touch.clientX, clientY: touch.clientY });
      }
    }, { passive: false });

    simCanvas.addEventListener('touchend', handlePointerLeave);

    // Start simulation loop
    animFrame = requestAnimationFrame(updatePhysics);
  }

  // ------------------------------------------------------------------------
  // 4. Games Filter Tabs
  // ------------------------------------------------------------------------
  const filterTabs = document.querySelectorAll('.filter-tab');
  const gameCards = document.querySelectorAll('.game-card');

  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const filterValue = tab.getAttribute('data-filter');

      gameCards.forEach(card => {
        const cardCategory = card.getAttribute('data-category');
        if (filterValue === 'all' || cardCategory === filterValue) {
          card.style.display = 'flex';
          setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, 10);
        } else {
          card.style.opacity = '0';
          card.style.transform = 'translateY(10px)';
          setTimeout(() => {
            card.style.display = 'none';
          }, 200);
        }
      });
    });
  });

  // ------------------------------------------------------------------------
  // 5. Game Specifications Modal
  // ------------------------------------------------------------------------
  const modalOverlay = document.getElementById('game-spec-modal');
  const modalCloseBtn = document.querySelector('.modal-close-btn');
  const modalTitle = document.getElementById('modal-game-title');
  const modalBody = document.getElementById('modal-game-body');
  const detailButtons = document.querySelectorAll('.btn-game-details');

  const gameSpecsData = {
    runner: {
      title: 'Gaze Runner — Technical Specifications',
      badge: 'Built-in Canvas 2D Engine',
      description: 'An original 3-lane endless runner rendered with HTML5 Canvas 2D. Built specifically to validate lateral yaw head-steering gestures with low cognitive strain.',
      specs: [
        { label: 'Primary Input', value: 'Lateral Head Turns (Yaw ΔX)' },
        { label: 'Target Action', value: 'Lane Shift (Left / Center / Right)' },
        { label: 'Rendering Pipeline', value: 'HTML5 Canvas 2D @ 60 FPS' },
        { label: 'Face Loss Safeguard', value: 'Instant Auto-Pause on Face Loss' },
        { label: 'Keyboard Alternative', value: 'A / D or Left / Right Arrow keys' },
        { label: 'Obstacle Generation', value: 'Dynamic hurdles with deterministic seed' },
        { label: 'Persistent Scores', value: 'Local high scores saved in browser storage' },
        { label: 'Accessibility Verification', value: 'Verified & fully playable within GazeMouse-OS' }
      ]
    },
    match: {
      title: 'Gaze Match — Technical Specifications',
      badge: 'Built-in Canvas 2D Puzzle Engine',
      description: 'An 8x8 match-3 puzzle game designed for fine cursor control and dwell-click interactions, helping players who prefer steady holding over rapid steering.',
      specs: [
        { label: 'Primary Input', value: 'Floating Virtual Head Cursor (ΔX, ΔY)' },
        { label: 'Selection Trigger', value: 'Configurable Dwell Hold (default 800ms)' },
        { label: 'Rendering Pipeline', value: 'HTML5 Canvas 2D @ 60 FPS' },
        { label: 'Colorblind Accessibility', value: 'Unique geometric glyphs + distinct high-contrast hues' },
        { label: 'Keyboard Alternative', value: 'Arrow Keys + Spacebar to swap' },
        { label: 'Auto-Pause Guard', value: 'Halts timer immediately if face tracking is lost' },
        { label: 'Sound & Visual Cues', value: 'Animated dwell progress ring with chime' },
        { label: 'Accessibility Verification', value: 'Verified & fully playable within GazeMouse-OS' }
      ]
    },
    runner3d: {
      title: 'Gaze 3D Runner — Technical Specifications',
      badge: 'Built-in Three.js WebGL Engine',
      description: 'An advanced 3D endless runner set on a futuristic Cyber Subway corridor. Renders high-speed perspective tracks using WebGL with guaranteed safe passages.',
      specs: [
        { label: 'Primary Input', value: 'Lateral Head Yaw Steering across 3 Tracks' },
        { label: 'Secondary Gestures', value: 'Upward pitch (Jump) & downward pitch (Slide)' },
        { label: 'Rendering Engine', value: 'Vanilla Three.js WebGL with dynamic lighting' },
        { label: 'Safe Route Algorithm', value: 'Guaranteed at least 1 open lane at all times' },
        { label: 'Keyboard Fallback', value: 'W / A / S / D or Arrow Keys' },
        { label: 'Performance Profile', value: 'Hardware-accelerated 60 FPS on standard integrated GPUs' },
        { label: 'Audio Integration', value: 'Synthesized Web Audio API sound effects' },
        { label: 'Accessibility Verification', value: 'Verified & fully playable within GazeMouse-OS' }
      ]
    },
    bridge: {
      title: 'Subway Surfers Desktop Bridge — Technical Specifications',
      badge: 'External Windows Desktop Bridge',
      description: 'The standalone Python 3 desktop bridge communicates with external game windows (e.g. Subway Surfers running on desktop) via loopback WebSocket and DirectInput scancodes.',
      specs: [
        { label: 'Bridge Architecture', value: 'Python 3 Standard Library (asyncio, ctypes, secrets)' },
        { label: 'Socket Connection', value: 'ws://127.0.0.1:8765 (Strictly Loopback)' },
        { label: 'Authentication', value: 'Ephemeral cryptographically random session token' },
        { label: 'Token Isolation', value: 'Windows NTFS ACLs (Current-User SID only)' },
        { label: 'Safety Watchdog', value: 'Inactivity timeout halts injection after 2.0s silence' },
        { label: 'Emergency Stop Hotkey', value: 'Ctrl + Alt + Q (Instant hardware lock)' },
        { label: 'Window Filtering', value: 'Foreground window title allowlist' },
        { label: 'Research & Status Note', value: 'Bridge protocol & injection verified; in-game browser window key routing under active research' }
      ]
    }
  };

  const openModal = (gameKey) => {
    const data = gameSpecsData[gameKey];
    if (!data || !modalOverlay) return;

    modalTitle.textContent = data.title;

    let html = `
      <div style="margin-bottom: 16px;">
        <span class="section-label" style="margin-bottom: 12px;"><span class="dot"></span>${data.badge}</span>
        <p style="color: var(--text-secondary); font-size: 0.95rem; line-height: 1.6; margin-top: 8px;">
          ${data.description}
        </p>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px; background: rgba(10, 15, 29, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); padding: 16px; border-radius: 12px;">
    `;

    data.specs.forEach(spec => {
      html += `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 6px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.04); font-size: 0.88rem;">
          <span style="color: var(--text-muted); font-family: var(--font-mono); font-size: 0.8rem;">${spec.label}:</span>
          <strong style="color: var(--text-primary); text-align: right; max-width: 60%;">${spec.value}</strong>
        </div>
      `;
    });

    html += `</div>`;
    modalBody.innerHTML = html;

    modalOverlay.classList.add('open');
    modalOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    modalCloseBtn?.focus();
  };

  const closeModal = () => {
    if (!modalOverlay) return;
    modalOverlay.classList.remove('open');
    modalOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  detailButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const gameKey = btn.getAttribute('data-game');
      if (gameKey) openModal(gameKey);
    });
  });

  modalCloseBtn?.addEventListener('click', closeModal);

  modalOverlay?.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay?.classList.contains('open')) {
      closeModal();
    }
  });
});

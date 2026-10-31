import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import {
  getInstallationId,
  getGuestHeaders,
  fetchRemotePreferences,
  saveRemotePreferences,
  recordGameSession,
  recordGameSessionOnUnload,
  buildSessionPayload,
  fetchBackendStats,
  resolveApiBaseUrl,
  API_BASE_URL,
  INSTALLATION_STORAGE_KEY,
  type GameSessionTelemetry,
  type BackendStats,
  getQueuedSessions,
  getQueueLength,
  drainQueue,
  clearQueue,
  resetTelemetryQueueStateForTest,
  clearRecordedSessionsForTest,
} from '../services/backendApi'
import { SessionTracker } from '../services/sessionTracker'
import { SettingsProvider, useSettings } from '../context/SettingsContext'
import { PlayerStatsDashboard } from '../components/common/PlayerStatsDashboard'

describe('Backend Integration & Guest Telemetry', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    resetTelemetryQueueStateForTest()
    clearRecordedSessionsForTest()
  })

  afterEach(() => {
    global.fetch = originalFetch
    resetTelemetryQueueStateForTest()
    clearRecordedSessionsForTest()
  })

  describe('1. Guest Installation Identity', () => {
    it('generates a valid UUID v4 when no installation ID exists in localStorage', () => {
      expect(localStorage.getItem(INSTALLATION_STORAGE_KEY)).toBeNull()

      const id = getInstallationId()
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      expect(localStorage.getItem(INSTALLATION_STORAGE_KEY)).toBe(id)
    })

    it('reuses the existing UUID across reloads without re-generating', () => {
      const existingUuid = '550e8400-e29b-41d4-a716-446655440000'
      localStorage.setItem(INSTALLATION_STORAGE_KEY, existingUuid)

      const id = getInstallationId()
      expect(id).toBe(existingUuid)
    })

    it('replaces corrupted or non-UUID localStorage values with a valid new UUID', () => {
      localStorage.setItem(INSTALLATION_STORAGE_KEY, 'invalid-non-uuid-value')

      const id = getInstallationId()
      expect(id).not.toBe('invalid-non-uuid-value')
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    })

    it('includes X-Installation-Id and JSON headers on guest requests', () => {
      const existingUuid = '550e8400-e29b-41d4-a716-446655440000'
      localStorage.setItem(INSTALLATION_STORAGE_KEY, existingUuid)

      const headers = getGuestHeaders()
      expect(headers['X-Installation-Id']).toBe(existingUuid)
      expect(headers['Content-Type']).toBe('application/json')
      expect(headers['Accept']).toBe('application/json')
    })
  })

  describe('2. Accessibility Preferences Synchronization', () => {
    it('fetches remote preferences from backend and maps to UserSettings', async () => {
      const mockResponse = {
        sensitivity: 2.5,
        smoothing: 0.45,
        deadZone: 15,
        dwellDuration: 1500,
        verticalGestures: true,
        soundEnabled: false,
        theme: 'dark',
        reducedMotion: true,
        highContrast: true,
        updatedAt: '2026-10-30T12:00:00Z',
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await fetchRemotePreferences()
      expect(result).not.toBeNull()
      expect(result?.sensitivity).toBe(2.5)
      expect(result?.theme).toBe('dark')
      expect(result?.verticalGestures).toBe(true)

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/preferences',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-Installation-Id': expect.any(String),
          }),
        })
      )
    })

    it('sends PUT /api/v1/preferences when saveRemotePreferences is called', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response)

      const settingsToSave = {
        sensitivity: 1.8,
        smoothing: 0.35,
        deadZone: 12,
        dwellDuration: 1100,
        verticalGestures: false,
        soundEnabled: true,
        theme: 'light' as const,
        reducedMotion: false,
        highContrast: false,
      }

      const success = await saveRemotePreferences(settingsToSave)
      expect(success).toBe(true)

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/preferences',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'X-Installation-Id': expect.any(String),
          }),
          body: JSON.stringify(settingsToSave),
        })
      )
    })

    it('SettingsProvider loads remote settings and applies them', async () => {
      const mockRemote = {
        sensitivity: 2.2,
        smoothing: 0.5,
        deadZone: 20,
        dwellDuration: 1400,
        verticalGestures: true,
        soundEnabled: false,
        theme: 'dark',
        reducedMotion: true,
        highContrast: true,
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRemote,
      } as Response)

      const TestComponent = () => {
        const { settings } = useSettings()
        return (
          <div>
            <span data-testid="theme">{settings.theme}</span>
            <span data-testid="sensitivity">{settings.sensitivity}</span>
          </div>
        )
      }

      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('theme').textContent).toBe('dark')
        expect(screen.getByTestId('sensitivity').textContent).toBe('2.2')
      })
    })

    it('fallback: maintains local settings when backend is unavailable', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'))

      const TestComponent = () => {
        const { settings, updateSetting } = useSettings()
        return (
          <div>
            <span data-testid="theme">{settings.theme}</span>
            <button onClick={() => updateSetting('theme', 'dark')}>Switch Dark</button>
          </div>
        )
      }

      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      )

      // Uses default light
      expect(screen.getByTestId('theme').textContent).toBe('light')

      // User change updates local state and localStorage without crashing
      fireEvent.click(screen.getByText('Switch Dark'))
      expect(screen.getByTestId('theme').textContent).toBe('dark')
      expect(localStorage.getItem('gazemouse_user_settings_v1')).toContain('"theme":"dark"')
    })
  })

  describe('3. Game Session Telemetry & Segregation', () => {
    it('maps 2D Gaze Runner metrics correctly and excludes 3D/match fields', async () => {
      let capturedBody: any = null
      global.fetch = vi.fn().mockImplementation((url, init) => {
        capturedBody = JSON.parse(init.body)
        return Promise.resolve({ status: 201, ok: true })
      })

      const tracker = new SessionTracker('GAZE_RUNNER', null)
      tracker.startSession()
      tracker.addActiveDuration(45)
      tracker.submitSession('COMPLETED', {
        score: 450,
        coinsCollected: 20,
        distancePixels: 5200,
        speedPxPerSec: 62.5,
      })

      await waitFor(() => {
        expect(capturedBody).not.toBeNull()
      })

      expect(capturedBody.gameId).toBe('GAZE_RUNNER')
      expect(capturedBody.gameMode).toBeNull()
      expect(capturedBody.completionStatus).toBe('COMPLETED')
      expect(capturedBody.score).toBe(450)
      expect(capturedBody.coinsCollected).toBe(20)
      expect(capturedBody.distancePixels).toBe(5200)
      expect(capturedBody.speedPxPerSec).toBe(62.5)
      // Must not contain 3D or match metrics
      expect(capturedBody.distanceMeters).toBeUndefined()
      expect(capturedBody.speedMPerSec).toBeUndefined()
      expect(capturedBody.movesMade).toBeUndefined()
    })

    it('maps 3D Gaze Runner metrics correctly and excludes 2D/match fields', async () => {
      let capturedBody: any = null
      global.fetch = vi.fn().mockImplementation((url, init) => {
        capturedBody = JSON.parse(init.body)
        return Promise.resolve({ status: 201, ok: true })
      })

      const tracker = new SessionTracker('GAZE_3D_RUNNER', null)
      tracker.startSession()
      tracker.addActiveDuration(60)
      tracker.submitSession('COMPLETED', {
        score: 600,
        coinsCollected: 35,
        distanceMeters: 350.25,
        speedMPerSec: 24.5,
      })

      await waitFor(() => {
        expect(capturedBody).not.toBeNull()
      })

      expect(capturedBody.gameId).toBe('GAZE_3D_RUNNER')
      expect(capturedBody.coinsCollected).toBe(35)
      expect(capturedBody.distanceMeters).toBe(350.25)
      expect(capturedBody.speedMPerSec).toBe(24.5)
      // Excludes 2D
      expect(capturedBody.distancePixels).toBeUndefined()
      expect(capturedBody.speedPxPerSec).toBeUndefined()
    })

    it('maps Gaze Match metrics correctly with CHALLENGE mode', async () => {
      let capturedBody: any = null
      global.fetch = vi.fn().mockImplementation((url, init) => {
        capturedBody = JSON.parse(init.body)
        return Promise.resolve({ status: 201, ok: true })
      })

      const tracker = new SessionTracker('GAZE_MATCH', 'CHALLENGE')
      tracker.startSession()
      tracker.submitSession('COMPLETED', {
        score: 1600,
        movesMade: 18,
        matchesCount: 14,
        movesRemaining: 2,
        targetScore: 1500,
        isWin: true,
      })

      await waitFor(() => {
        expect(capturedBody).not.toBeNull()
      })

      expect(capturedBody.gameId).toBe('GAZE_MATCH')
      expect(capturedBody.gameMode).toBe('CHALLENGE')
      expect(capturedBody.score).toBe(1600)
      expect(capturedBody.movesMade).toBe(18)
      expect(capturedBody.matchesCount).toBe(14)
      expect(capturedBody.movesRemaining).toBe(2)
      expect(capturedBody.targetScore).toBe(1500)
      expect(capturedBody.isWin).toBe(true)
      // Excludes runner
      expect(capturedBody.coinsCollected).toBeUndefined()
      expect(capturedBody.distancePixels).toBeUndefined()
    })

    it('submits ABANDONED and INTERRUPTED completion statuses appropriately', async () => {
      const capturedStatuses: string[] = []
      global.fetch = vi.fn().mockImplementation((url, init) => {
        const body = JSON.parse(init.body)
        capturedStatuses.push(body.completionStatus)
        return Promise.resolve({ status: 201, ok: true })
      })

      const tracker1 = new SessionTracker('GAZE_RUNNER')
      tracker1.startSession()
      tracker1.submitSession('ABANDONED', { score: 100, coinsCollected: 2, distancePixels: 500, speedPxPerSec: 50 })

      const tracker2 = new SessionTracker('GAZE_RUNNER')
      tracker2.startSession()
      tracker2.submitSession('INTERRUPTED', { score: 50, coinsCollected: 1, distancePixels: 200, speedPxPerSec: 50 })

      await waitFor(() => {
        expect(capturedStatuses).toEqual(['ABANDONED', 'INTERRUPTED'])
      })
    })

    it('prevents duplicate submissions of the same session instance', async () => {
      let callCount = 0
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++
        return Promise.resolve({ status: 201, ok: true })
      })

      const tracker = new SessionTracker('GAZE_RUNNER')
      tracker.startSession()
      tracker.submitSession('COMPLETED', { score: 200, coinsCollected: 5, distancePixels: 1000, speedPxPerSec: 50 })
      // Subsequent duplicate call
      tracker.submitSession('COMPLETED', { score: 200, coinsCollected: 5, distancePixels: 1000, speedPxPerSec: 50 })

      await waitFor(() => {
        expect(callCount).toBe(1)
      })
    })
  })

  describe('4. Statistics Retrieval & Dashboard UI', () => {
    it('retrieves overall statistics from GET /api/v1/stats', async () => {
      const mockStats: BackendStats = {
        gameId: null,
        totalSessions: 10,
        completedSessions: 8,
        abandonedSessions: 1,
        interruptedSessions: 1,
        totalPlayTimeSeconds: 1200,
        highScore: 850,
        averageScore: 450.5,
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockStats,
      } as Response)

      const result = await fetchBackendStats()
      expect(result).not.toBeNull()
      expect(result?.totalSessions).toBe(10)
      expect(result?.highScore).toBe(850)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/stats',
        expect.any(Object)
      )
    })

    it('passes gameId query parameter when filtered', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ gameId: 'GAZE_RUNNER', totalSessions: 4 }),
      } as Response)

      await fetchBackendStats('GAZE_RUNNER')
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/stats?gameId=GAZE_RUNNER',
        expect.any(Object)
      )
    })

    it('PlayerStatsDashboard renders backend synchronized stats when online', async () => {
      const mockStats: BackendStats = {
        gameId: null,
        totalSessions: 12,
        completedSessions: 10,
        abandonedSessions: 1,
        interruptedSessions: 1,
        totalPlayTimeSeconds: 900,
        highScore: 920,
        averageScore: 510.0,
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockStats,
      } as Response)

      render(<PlayerStatsDashboard />)

      await waitFor(() => {
        expect(screen.getByText(/Synchronized with Backend/i)).toBeInTheDocument()
        expect(screen.getByText('12')).toBeInTheDocument() // Total sessions
        expect(screen.getByText('920')).toBeInTheDocument() // High score
      })
    })

    it('PlayerStatsDashboard gracefully falls back to local storage when backend is offline', async () => {
      localStorage.setItem('gazemouse_runner_highscore_v1', '750')
      localStorage.setItem('gazemouse_runner3d_highscore_v1', '620')
      localStorage.setItem('gazemouse_match_highscore_v1', '1800')

      global.fetch = vi.fn().mockRejectedValue(new Error('Backend offline'))

      render(<PlayerStatsDashboard />)

      await waitFor(() => {
        expect(screen.getByText(/Local Storage \(Offline Mode\)/i)).toBeInTheDocument()
        expect(screen.getByText('750')).toBeInTheDocument()
        expect(screen.getByText('620')).toBeInTheDocument()
        expect(screen.getByText('1800')).toBeInTheDocument()
      })
    })
  })

  describe('5. Configurable API Base URL (Milestone 6A)', () => {
    it('defaults to relative /api/v1 when environment variable is unset', () => {
      expect(resolveApiBaseUrl(undefined)).toBe('/api/v1')
      expect(API_BASE_URL).toBe('/api/v1')
    })

    it('defaults to relative /api/v1 when environment variable is empty or whitespace', () => {
      expect(resolveApiBaseUrl('')).toBe('/api/v1')
      expect(resolveApiBaseUrl('   ')).toBe('/api/v1')
    })

    it('normalizes configured base URL without trailing slash', () => {
      expect(resolveApiBaseUrl('https://api.gazemouse.example.com')).toBe(
        'https://api.gazemouse.example.com/api/v1'
      )
    })

    it('normalizes single and multiple trailing slashes without double slashes', () => {
      expect(resolveApiBaseUrl('https://api.gazemouse.example.com/')).toBe(
        'https://api.gazemouse.example.com/api/v1'
      )
      expect(resolveApiBaseUrl('https://api.gazemouse.example.com///')).toBe(
        'https://api.gazemouse.example.com/api/v1'
      )
    })

    it('constructs correct request URLs and keeps X-Installation-Id when VITE_BACKEND_API_URL is configured', async () => {
      const customOrigin = 'https://api.gazemouse.example.com'
      vi.stubEnv('VITE_BACKEND_API_URL', customOrigin)

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          sensitivity: 1.5,
          smoothing: 0.3,
          deadZone: 10,
          dwellDuration: 1200,
          verticalGestures: false,
          soundEnabled: true,
          theme: 'light',
          reducedMotion: false,
          highContrast: false,
        }),
      } as Response)

      await fetchRemotePreferences()

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.gazemouse.example.com/api/v1/preferences',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-Installation-Id': expect.any(String),
          }),
        })
      )

      vi.unstubAllEnvs()
    })

    it('routes session telemetry and statistics to configured base URL', async () => {
      const customOrigin = 'https://api.gazemouse.example.com/'
      vi.stubEnv('VITE_BACKEND_API_URL', customOrigin)

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({}),
      } as Response)

      await recordGameSession({
        id: '11111111-2222-3333-4444-555555555555',
        gameId: 'GAZE_RUNNER',
        completionStatus: 'COMPLETED',
        score: 100,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        durationSeconds: 10,
        coinsCollected: 5,
        distancePixels: 200,
        speedPxPerSec: 20,
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.gazemouse.example.com/api/v1/sessions',
        expect.objectContaining({
          method: 'POST',
        })
      )

      await fetchBackendStats('GAZE_MATCH')
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.gazemouse.example.com/api/v1/stats?gameId=GAZE_MATCH',
        expect.objectContaining({
          method: 'GET',
        })
      )

      vi.unstubAllEnvs()
    })
  })

  describe('6. Reliable Game Session Lifecycle (Milestone 6B)', () => {
    it('restarting an active session submits the old session as ABANDONED with captured metrics', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({}),
      } as Response)

      const tracker = new SessionTracker('GAZE_RUNNER', null)
      const oldSessionId = tracker.startSession()
      tracker.addActiveDuration(12.5)

      const oldMetrics = {
        score: 450,
        coinsCollected: 12,
        distancePixels: 800,
        speedPxPerSec: 350.0,
      }

      const newSessionId = tracker.restartSession(oldMetrics)

      expect(newSessionId).not.toBe(oldSessionId)
      expect(tracker.isSessionActive()).toBe(true)

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/sessions',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"completionStatus":"ABANDONED"'),
        })
      )

      const lastCall = (global.fetch as any).mock.calls[0]
      const body = JSON.parse(lastCall[1].body)
      expect(body.id).toBe(oldSessionId)
      expect(body.completionStatus).toBe('ABANDONED')
      expect(body.score).toBe(450)
      expect(body.coinsCollected).toBe(12)
      expect(body.distancePixels).toBe(800)
      expect(body.speedPxPerSec).toBe(350.0)

      tracker.dispose()
    })

    it('new session starts with clean timers and metrics after restart', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) } as Response)

      const tracker = new SessionTracker('GAZE_3D_RUNNER', null)
      tracker.startSession()
      tracker.addActiveDuration(45)

      tracker.restartSession({ score: 100, coinsCollected: 2, distanceMeters: 50, speedMPerSec: 5 })
      tracker.addActiveDuration(5)

      // Complete the new session
      tracker.submitSession('COMPLETED', {
        score: 20,
        coinsCollected: 1,
        distanceMeters: 10,
        speedMPerSec: 2,
      })

      expect((global.fetch as any).mock.calls).toHaveLength(2)
      const secondCallBody = JSON.parse((global.fetch as any).mock.calls[1][1].body)
      expect(secondCallBody.completionStatus).toBe('COMPLETED')
      expect(secondCallBody.score).toBe(20)
      expect(secondCallBody.durationSeconds).toBeLessThanOrEqual(10) // Only 5s accumulated in new session

      tracker.dispose()
    })

    it('restarting a completed session does not create an incorrect ABANDONED submission', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) } as Response)

      const tracker = new SessionTracker('GAZE_MATCH', 'CHALLENGE')
      tracker.startSession()

      tracker.submitSession('COMPLETED', {
        score: 1500,
        movesMade: 14,
        matchesCount: 8,
        movesRemaining: 6,
        targetScore: 1500,
        isWin: true,
      })

      expect((global.fetch as any).mock.calls).toHaveLength(1)
      expect(tracker.isSessionActive()).toBe(false)
      expect(tracker.getState()).toBe('COMPLETED')

      // Now restart after game over
      const newSessionId = tracker.restartSession({
        score: 1500,
        movesMade: 14,
        matchesCount: 8,
        movesRemaining: 6,
        targetScore: 1500,
        isWin: true,
      })

      // Still only 1 network call: no spurious ABANDONED was sent!
      expect((global.fetch as any).mock.calls).toHaveLength(1)
      expect(tracker.isSessionActive()).toBe(true)
      expect(tracker.getSessionId()).toBe(newSessionId)

      tracker.dispose()
    })

    it('rapid repeated restarts produce clean unique sessions without duplicate submissions', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) } as Response)

      const tracker = new SessionTracker('GAZE_RUNNER', null)
      const id1 = tracker.startSession()
      const id2 = tracker.restartSession({ score: 10, coinsCollected: 1, distancePixels: 20, speedPxPerSec: 10 })
      const id3 = tracker.restartSession({ score: 20, coinsCollected: 2, distancePixels: 40, speedPxPerSec: 10 })

      expect(id1).not.toBe(id2)
      expect(id2).not.toBe(id3)
      expect((global.fetch as any).mock.calls).toHaveLength(2)

      const body1 = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      const body2 = JSON.parse((global.fetch as any).mock.calls[1][1].body)
      expect(body1.id).toBe(id1)
      expect(body2.id).toBe(id2)

      tracker.dispose()
    })

    it('pagehide event submits an active session as INTERRUPTED using keepalive', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) } as Response)

      const tracker = new SessionTracker('GAZE_RUNNER', null)
      tracker.registerMetricsProvider(() => ({
        score: 300,
        coinsCollected: 9,
        distancePixels: 600,
        speedPxPerSec: 320,
      }))

      const sessionId = tracker.startSession()
      tracker.addActiveDuration(8)

      // Simulate browser tab close / pagehide
      window.dispatchEvent(new Event('pagehide'))

      expect(tracker.isSessionActive()).toBe(false)
      expect(tracker.getState()).toBe('INTERRUPTED')

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/sessions',
        expect.objectContaining({
          method: 'POST',
          keepalive: true,
          headers: expect.objectContaining({
            'X-Installation-Id': expect.any(String),
          }),
        })
      )

      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(body.id).toBe(sessionId)
      expect(body.completionStatus).toBe('INTERRUPTED')
      expect(body.score).toBe(300)
      expect(body.coinsCollected).toBe(9)

      tracker.dispose()
    })

    it('pagehide followed by unmount does not duplicate submission', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) } as Response)

      const tracker = new SessionTracker('GAZE_MATCH', 'CHALLENGE')
      tracker.registerMetricsProvider(() => ({
        score: 500,
        movesMade: 5,
        matchesCount: 3,
        movesRemaining: 15,
        targetScore: 1500,
        isWin: false,
      }))

      tracker.startSession()

      // 1. pagehide fires first
      window.dispatchEvent(new Event('pagehide'))
      expect((global.fetch as any).mock.calls).toHaveLength(1)

      // 2. React unmount fires subsequently
      tracker.submitSession('INTERRUPTED', {
        score: 500,
        movesMade: 5,
        matchesCount: 3,
      })

      // Must remain exactly 1 call
      expect((global.fetch as any).mock.calls).toHaveLength(1)

      tracker.dispose()
    })

    it('completed or abandoned sessions are not resubmitted upon pagehide', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) } as Response)

      const tracker = new SessionTracker('GAZE_3D_RUNNER', null)
      tracker.startSession()
      tracker.submitSession('ABANDONED', {
        score: 80,
        coinsCollected: 3,
        distanceMeters: 40,
        speedMPerSec: 4,
      })

      expect((global.fetch as any).mock.calls).toHaveLength(1)

      // Dispatch pagehide after abandonment
      window.dispatchEvent(new Event('pagehide'))

      // No new submission!
      expect((global.fetch as any).mock.calls).toHaveLength(1)

      tracker.dispose()
    })

    it('recordGameSessionOnUnload gracefully catches errors without throwing', () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network failure during unload'))

      expect(() => {
        const result = recordGameSessionOnUnload({
          id: '99999999-8888-7777-6666-555555555555',
          gameId: 'GAZE_RUNNER',
          completionStatus: 'INTERRUPTED',
          score: 0,
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          durationSeconds: 0,
          coinsCollected: 0,
          distancePixels: 0,
          speedPxPerSec: 0,
        })
        expect(result).toBe(true)
      }).not.toThrow()
    })

    it('buildSessionPayload strictly excludes camera, biometrics, and cross-game fields', () => {
      const payload = buildSessionPayload({
        id: '12345678-1234-1234-1234-123456789abc',
        gameId: 'GAZE_RUNNER',
        completionStatus: 'COMPLETED',
        score: 500,
        startedAt: '2026-10-31T00:00:00Z',
        endedAt: '2026-10-31T00:01:00Z',
        durationSeconds: 60,
        coinsCollected: 10,
        distancePixels: 1500,
        speedPxPerSec: 300,
        // Prohibited fields that must NOT appear
        distanceMeters: 999,
        speedMPerSec: 999,
        movesMade: 999,
      } as any)

      expect(payload.gameId).toBe('GAZE_RUNNER')
      expect(payload.distancePixels).toBe(1500)
      expect(payload.distanceMeters).toBeUndefined()
      expect(payload.speedMPerSec).toBeUndefined()
      expect(payload.movesMade).toBeUndefined()
      expect((payload as any).faceLandmarks).toBeUndefined()
      expect((payload as any).cameraFrame).toBeUndefined()
      expect((payload as any).rawGaze).toBeUndefined()
    })
  })

  describe('7. Persistent Offline Telemetry Queue Integration (Milestone 6C)', () => {
    it('persists game session to offline queue when backend is unreachable during gameplay submission', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network offline: Failed to fetch'))

      const tracker = new SessionTracker('GAZE_RUNNER', null)
      const sessionId = tracker.startSession()
      tracker.addActiveDuration(30)
      tracker.submitSession('COMPLETED', {
        score: 750,
        coinsCollected: 20,
        distancePixels: 3500,
        speedPxPerSec: 120,
      })

      await waitFor(() => {
        expect(getQueueLength()).toBe(1)
      })

      const [record] = getQueuedSessions()
      expect(record.session.id).toBe(sessionId)
      expect(record.session.score).toBe(750)
      expect(record.session.coinsCollected).toBe(20)
      expect(record.session.distancePixels).toBe(3500)
      expect(record.session.completionStatus).toBe('COMPLETED')
      tracker.dispose()
    })

    it('drains queued offline session automatically when network is restored', async () => {
      // 1. Session created offline and queued
      global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'))
      const tracker = new SessionTracker('GAZE_3D_RUNNER', null)
      const sessionId = tracker.startSession()
      tracker.submitSession('COMPLETED', {
        score: 1200,
        coinsCollected: 50,
        distanceMeters: 600,
        speedMPerSec: 30,
      })

      await waitFor(() => {
        expect(getQueueLength()).toBe(1)
      })

      // 2. Network restored: backend accepts session
      global.fetch = vi.fn().mockResolvedValue({
        status: 201,
        ok: true,
        json: async () => ({ id: sessionId }),
      } as Response)

      const result = await drainQueue(true)
      expect(result.sent).toBe(1)
      expect(getQueueLength()).toBe(0)
      tracker.dispose()
    })

    it('pagehide unload persists session to queue, safely reconciled by idempotent replay', async () => {
      global.fetch = vi.fn().mockImplementation(() => Promise.reject(new Error('Process terminated during unload')))

      const tracker = new SessionTracker('GAZE_MATCH', 'CHALLENGE')
      tracker.registerMetricsProvider(() => ({
        score: 800,
        movesMade: 10,
        matchesCount: 6,
        movesRemaining: 10,
        targetScore: 1500,
        isWin: false,
      }))

      const sessionId = tracker.startSession()

      // Trigger unload
      window.dispatchEvent(new Event('pagehide'))

      // Verified: session is saved in durable queue
      expect(getQueueLength()).toBe(1)
      const [record] = getQueuedSessions()
      expect(record.session.id).toBe(sessionId)
      expect(record.session.completionStatus).toBe('INTERRUPTED')

      // Next app launch: backend returns 200 OK (idempotent duplicate submission)
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ id: sessionId }),
      } as Response)

      const drainResult = await drainQueue(true)
      expect(drainResult.sent).toBe(1)
      expect(getQueueLength()).toBe(0)

      tracker.dispose()
    })
  })
})


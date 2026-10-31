import type { UserSettings } from '../types/settings'
import {
  enqueueSession,
  removeQueuedSession,
  isInFlight,
  markInFlight,
  clearInFlight,
} from './telemetryQueue'

export const INSTALLATION_STORAGE_KEY = 'gazemouse_installation_id_v1'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const DEFAULT_TIMEOUT_MS = 4000

/**
 * Resolves the API base URL from Vite environment variables.
 * - If VITE_BACKEND_API_URL is configured, trims whitespace, strips trailing slashes, and appends '/api/v1'.
 * - If unset, empty, or whitespace-only, returns relative '/api/v1' for development proxying and offline resilience.
 */
export function resolveApiBaseUrl(rawEnvUrl?: string): string {
  const envUrl = rawEnvUrl !== undefined
    ? rawEnvUrl
    : (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_BACKEND_API_URL : undefined)

  if (typeof envUrl === 'string') {
    const trimmed = envUrl.trim().replace(/\/+$/, '')
    if (trimmed) {
      return `${trimmed}/api/v1`
    }
  }
  return '/api/v1'
}

export const API_BASE_URL = resolveApiBaseUrl()

/**
 * Generates an RFC 4122 compliant UUID v4 string.
 */
function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Safe fallback for environments lacking crypto.randomUUID
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // Variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Retrieves the persistent anonymous guest installation ID.
 * Generates and stores a new UUID if none exists.
 */
export function getInstallationId(): string {
  try {
    const existing = localStorage.getItem(INSTALLATION_STORAGE_KEY)
    if (existing && UUID_REGEX.test(existing.trim())) {
      return existing.trim()
    }
    const newId = generateUuid()
    localStorage.setItem(INSTALLATION_STORAGE_KEY, newId)
    return newId
  } catch {
    // If localStorage is unavailable, return a temporary session UUID
    return generateUuid()
  }
}

/**
 * Prepares standard guest headers with X-Installation-Id.
 */
export function getGuestHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Installation-Id': getInstallationId(),
  }
}

/**
 * Wrapper for fetch requests with automatic timeout and error safety.
 */
export async function fetchWithTimeout(
  input: string,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

// ============================================================================
// 1. Accessibility Preferences API
// ============================================================================

export interface RemotePreferencesResponse {
  sensitivity: number
  smoothing: number
  deadZone: number
  dwellDuration: number
  verticalGestures: boolean
  soundEnabled: boolean
  theme: 'light' | 'dark'
  reducedMotion: boolean
  highContrast: boolean
  updatedAt?: string
}

/**
 * Fetches guest accessibility preferences from the backend.
 * Returns null if backend is offline or unreachable.
 */
export async function fetchRemotePreferences(): Promise<UserSettings | null> {
  try {
    const res = await fetchWithTimeout(`${resolveApiBaseUrl()}/preferences`, {
      method: 'GET',
      headers: getGuestHeaders(),
    })

    if (!res.ok) {
      return null
    }

    const data: RemotePreferencesResponse = await res.json()
    return {
      sensitivity: Number(data.sensitivity),
      smoothing: Number(data.smoothing),
      deadZone: Number(data.deadZone),
      dwellDuration: Number(data.dwellDuration),
      verticalGestures: Boolean(data.verticalGestures),
      soundEnabled: Boolean(data.soundEnabled),
      theme: data.theme === 'dark' ? 'dark' : 'light',
      reducedMotion: Boolean(data.reducedMotion),
      highContrast: Boolean(data.highContrast),
    }
  } catch {
    // Silently fall back to local settings
    return null
  }
}

/**
 * Persists guest accessibility preferences to the backend.
 * Non-blocking, fails gracefully when backend is unreachable.
 */
export async function saveRemotePreferences(settings: UserSettings): Promise<boolean> {
  try {
    const payload = {
      sensitivity: Number(settings.sensitivity.toFixed(2)),
      smoothing: Number(settings.smoothing.toFixed(2)),
      deadZone: Math.round(settings.deadZone),
      dwellDuration: Math.round(settings.dwellDuration),
      verticalGestures: Boolean(settings.verticalGestures),
      soundEnabled: Boolean(settings.soundEnabled),
      theme: settings.theme === 'dark' ? 'dark' : 'light',
      reducedMotion: Boolean(settings.reducedMotion),
      highContrast: Boolean(settings.highContrast),
    }

    const res = await fetchWithTimeout(`${resolveApiBaseUrl()}/preferences`, {
      method: 'PUT',
      headers: getGuestHeaders(),
      body: JSON.stringify(payload),
    })

    return res.ok
  } catch {
    return false
  }
}

// ============================================================================
// 2. Game Session Telemetry API
// ============================================================================

export interface GameSessionTelemetry {
  id: string
  gameId: 'GAZE_RUNNER' | 'GAZE_MATCH' | 'GAZE_3D_RUNNER'
  gameMode?: string | null
  completionStatus: 'COMPLETED' | 'ABANDONED' | 'INTERRUPTED'
  score: number
  startedAt: string
  endedAt: string
  durationSeconds: number

  // 2D Canvas Runner Metrics
  coinsCollected?: number | null
  distancePixels?: number | null
  speedPxPerSec?: number | null

  // 3D WebGL Runner Metrics
  distanceMeters?: number | null
  speedMPerSec?: number | null

  // Gaze Match Metrics
  movesMade?: number | null
  movesRemaining?: number | null
  matchesCount?: number | null
  targetScore?: number | null
  isWin?: boolean | null
}

export const recordedSessionsSet = new Set<string>()

export function isSessionRecorded(id: string): boolean {
  return recordedSessionsSet.has(id)
}

export function markSessionRecorded(id: string): void {
  recordedSessionsSet.add(id)
}

export function clearRecordedSessionsForTest(): void {
  recordedSessionsSet.clear()
}

/**
 * Sanitizes and segregates session metrics according to backend schema rules.
 */
export function buildSessionPayload(session: GameSessionTelemetry): Record<string, any> {
  const payload: Record<string, any> = {
    id: session.id,
    gameId: session.gameId,
    gameMode: session.gameMode ?? null,
    completionStatus: session.completionStatus,
    score: Math.max(0, Math.round(session.score)),
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationSeconds: Math.max(0, Math.min(86400, Math.round(session.durationSeconds))),
  }

  if (session.gameId === 'GAZE_RUNNER') {
    payload.coinsCollected = Math.max(0, Math.round(session.coinsCollected ?? 0))
    payload.distancePixels = Math.max(0, Math.round(session.distancePixels ?? 0))
    payload.speedPxPerSec = Number((session.speedPxPerSec ?? 0).toFixed(2))
  } else if (session.gameId === 'GAZE_3D_RUNNER') {
    payload.coinsCollected = Math.max(0, Math.round(session.coinsCollected ?? 0))
    payload.distanceMeters = Number((session.distanceMeters ?? 0).toFixed(2))
    payload.speedMPerSec = Number((session.speedMPerSec ?? 0).toFixed(2))
  } else if (session.gameId === 'GAZE_MATCH') {
    payload.gameMode = session.gameMode || 'CHALLENGE'
    payload.movesMade = Math.max(0, Math.round(session.movesMade ?? 0))
    payload.matchesCount = Math.max(0, Math.round(session.matchesCount ?? 0))
    if (session.movesRemaining != null) {
      payload.movesRemaining = Math.max(0, Math.round(session.movesRemaining))
    }
    if (session.targetScore != null) {
      payload.targetScore = Math.max(0, Math.round(session.targetScore))
    }
    if (session.isWin != null) {
      payload.isWin = Boolean(session.isWin)
    }
  }

  return payload
}

/**
 * Records a game session telemetry record during page unload/pagehide.
 * Uses fetch with { keepalive: true } to allow the request to outlive the document.
 * Simultaneously enqueues into offline storage to guarantee no data loss if process closes abruptly.
 */
export function recordGameSessionOnUnload(session: GameSessionTelemetry): boolean {
  if (isSessionRecorded(session.id)) {
    return true
  }

  // Immediately track in-memory to prevent duplicate submissions from simultaneous unmount/pagehide
  markSessionRecorded(session.id)

  // Durably persist to offline storage queue so that if keepalive is dropped or killed, the session survives
  enqueueSession(session)

  try {
    const payload = buildSessionPayload(session)
    const url = `${resolveApiBaseUrl()}/sessions`
    const headers = getGuestHeaders()

    if (typeof fetch === 'function') {
      fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        keepalive: true,
      })
        .then((res) => {
          if (res.status === 201 || res.status === 200 || res.status === 409) {
            removeQueuedSession(session.id)
          }
        })
        .catch(() => {
          // Unload context: response cannot be consumed, session remains safely preserved in queue
        })
      return true
    }
  } catch {
    // Unload execution must never throw or block browser closure
  }
  return false
}

/**
 * Records a game session telemetry record.
 * Idempotent: client UUID is reused, duplicate in-memory submissions are prevented.
 * Enqueues to offline telemetry queue on network or server error.
 */
export async function recordGameSession(session: GameSessionTelemetry): Promise<boolean> {
  // Prevent duplicate submissions of already recorded sessions
  if (isSessionRecorded(session.id)) {
    return true
  }

  // Prevent duplicate concurrent in-flight requests for the same session ID
  if (isInFlight(session.id)) {
    return false
  }

  // If known to be offline, persist directly to queue without waiting for network timeout
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    enqueueSession(session)
    return false
  }

  markInFlight(session.id)

  try {
    const payload = buildSessionPayload(session)

    const res = await fetchWithTimeout(`${resolveApiBaseUrl()}/sessions`, {
      method: 'POST',
      headers: getGuestHeaders(),
      body: JSON.stringify(payload),
    })

    if (res.status === 201 || res.status === 200) {
      markSessionRecorded(session.id)
      removeQueuedSession(session.id)
      return true
    } else if (res.status === 409) {
      // Conflict: already recorded with different payload or installation
      markSessionRecorded(session.id)
      removeQueuedSession(session.id)
      return false
    } else if (res.status >= 500) {
      // Server error: retryable, persist to offline queue
      enqueueSession(session)
      return false
    }

    return false
  } catch {
    // Network failure: silent failure for UI, persist to offline queue
    enqueueSession(session)
    return false
  } finally {
    clearInFlight(session.id)
  }
}

// ============================================================================
// 3. Game Statistics API
// ============================================================================

export interface BackendStats {
  gameId: string | null
  totalSessions: number
  completedSessions: number
  abandonedSessions: number
  interruptedSessions: number
  totalPlayTimeSeconds: number
  highScore: number
  averageScore: number
  gazeRunner?: {
    totalCoinsCollected: number
    maxDistancePixels: number
    maxSpeedPxPerSec: number
  } | null
  gaze3dRunner?: {
    totalCoinsCollected: number
    maxDistanceMeters: number
    maxSpeedMPerSec: number
  } | null
  gazeMatch?: {
    totalMatches: number
    totalMoves: number
    gamesWon: number
    winRate: number
  } | null
}

/**
 * Fetches guest statistics, optionally filtered by gameId.
 * Returns null if backend is offline or unreachable.
 */
export async function fetchBackendStats(gameId?: string): Promise<BackendStats | null> {
  try {
    const baseUrl = resolveApiBaseUrl()
    const url = gameId
      ? `${baseUrl}/stats?gameId=${encodeURIComponent(gameId)}`
      : `${baseUrl}/stats`

    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: getGuestHeaders(),
    })

    if (!res.ok) {
      return null
    }

    return await res.json()
  } catch {
    return null
  }
}

// Re-export telemetry queue services
export * from './telemetryQueue'

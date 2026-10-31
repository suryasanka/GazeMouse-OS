import { recordGameSession, recordGameSessionOnUnload, type GameSessionTelemetry } from './backendApi'

export interface SessionMetrics {
  score: number
  // 2D Runner
  coinsCollected?: number | null
  distancePixels?: number | null
  speedPxPerSec?: number | null
  // 3D Runner
  distanceMeters?: number | null
  speedMPerSec?: number | null
  // Gaze Match
  movesMade?: number | null
  movesRemaining?: number | null
  matchesCount?: number | null
  targetScore?: number | null
  isWin?: boolean | null
}

export type SessionState = 'IDLE' | 'ACTIVE' | 'COMPLETED' | 'ABANDONED' | 'INTERRUPTED'

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Manages game session lifecycle, timing, and idempotent telemetry submission.
 * Enforces terminal state transitions: exactly one terminal status per session.
 * Handles in-flight restart abandonment and pagehide unload interruptions.
 */
export class SessionTracker {
  private readonly gameId: 'GAZE_RUNNER' | 'GAZE_MATCH' | 'GAZE_3D_RUNNER'
  private readonly gameMode?: string | null
  private sessionId: string | null = null
  private startedAt: string | null = null
  private durationSeconds = 0
  private state: SessionState = 'IDLE'
  private metricsProvider: (() => SessionMetrics) | null = null

  constructor(
    gameId: 'GAZE_RUNNER' | 'GAZE_MATCH' | 'GAZE_3D_RUNNER',
    gameMode?: string | null
  ) {
    this.gameId = gameId
    this.gameMode = gameMode

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('pagehide', this.handlePageHide)
    }
  }

  /**
   * Registers a provider callback that returns the latest real-time metrics from the active game engine.
   * Invoked during abrupt pagehide/unload to guarantee actual final gameplay values are transmitted.
   */
  public registerMetricsProvider(provider: () => SessionMetrics): () => void {
    this.metricsProvider = provider
    return () => {
      if (this.metricsProvider === provider) {
        this.metricsProvider = null
      }
    }
  }

  private handlePageHide = (): void => {
    if (this.isSessionActive()) {
      const metrics = this.metricsProvider ? this.metricsProvider() : { score: 0 }
      this.submitSession('INTERRUPTED', metrics, true /* isOnUnload */)
    }
  }

  /**
   * Cleans up global browser listeners. Call on component unmount.
   */
  public dispose(): void {
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('pagehide', this.handlePageHide)
    }
  }

  /**
   * Starts a new game session with a fresh client UUID.
   * If a previous session is still active, automatically submits it as ABANDONED
   * with the provided metrics (or from metricsProvider) before starting the new session.
   */
  public startSession(previousMetricsIfActive?: SessionMetrics): string {
    if (this.isSessionActive()) {
      const metrics = previousMetricsIfActive ?? (this.metricsProvider ? this.metricsProvider() : { score: 0 })
      this.submitSession('ABANDONED', metrics)
    }

    this.sessionId = generateUuid()
    this.startedAt = new Date().toISOString()
    this.durationSeconds = 0
    this.state = 'ACTIVE'
    return this.sessionId
  }

  /**
   * Explicitly restarts an active session.
   * Convenience alias for startSession(previousMetrics).
   */
  public restartSession(previousMetrics?: SessionMetrics): string {
    return this.startSession(previousMetrics)
  }

  /**
   * Accumulates active gameplay duration in seconds.
   */
  public addActiveDuration(dtSeconds: number): void {
    if (this.state === 'ACTIVE') {
      this.durationSeconds += Math.max(0, dtSeconds)
    }
  }

  /**
   * Checks whether a session is currently active and unrecorded.
   */
  public isSessionActive(): boolean {
    return this.state === 'ACTIVE' && this.sessionId !== null
  }

  /**
   * Returns the current lifecycle state of this tracker.
   */
  public getState(): SessionState {
    return this.state
  }

  /**
   * Returns the current session ID, if any.
   */
  public getSessionId(): string | null {
    return this.sessionId
  }

  /**
   * Submits the session record with the specified completion status and final metrics.
   * Enforces strict state transitions: only ACTIVE sessions can transition to a terminal state.
   * Subsequent terminal transitions are ignored.
   */
  public submitSession(
    status: 'COMPLETED' | 'ABANDONED' | 'INTERRUPTED',
    metrics: SessionMetrics,
    isOnUnload: boolean = false
  ): void {
    if (!this.sessionId || !this.startedAt || this.state !== 'ACTIVE') {
      return
    }

    this.state = status
    const endedAt = new Date().toISOString()

    // Calculate elapsed wall-clock seconds to ensure duration consistency
    const startTimeMs = new Date(this.startedAt).getTime()
    const endTimeMs = new Date(endedAt).getTime()
    const elapsedWallClockSec = Math.max(0, Math.round((endTimeMs - startTimeMs) / 1000))

    // Duration cannot exceed elapsed wall clock time + tolerance
    const finalDuration = Math.min(
      Math.max(0, Math.round(this.durationSeconds)),
      elapsedWallClockSec + 5
    )

    const payload: GameSessionTelemetry = {
      id: this.sessionId,
      gameId: this.gameId,
      gameMode: this.gameMode ?? null,
      completionStatus: status,
      score: metrics.score,
      startedAt: this.startedAt,
      endedAt,
      durationSeconds: finalDuration,
      coinsCollected: metrics.coinsCollected,
      distancePixels: metrics.distancePixels,
      speedPxPerSec: metrics.speedPxPerSec,
      distanceMeters: metrics.distanceMeters,
      speedMPerSec: metrics.speedMPerSec,
      movesMade: metrics.movesMade,
      movesRemaining: metrics.movesRemaining,
      matchesCount: metrics.matchesCount,
      targetScore: metrics.targetScore,
      isWin: metrics.isWin,
    }

    // Fire submission (keepalive for unload; regular fetchWithTimeout otherwise)
    if (isOnUnload) {
      recordGameSessionOnUnload(payload)
    } else {
      recordGameSession(payload)
    }
  }
}

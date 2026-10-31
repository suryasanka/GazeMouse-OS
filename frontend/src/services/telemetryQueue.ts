import {
  type GameSessionTelemetry,
  buildSessionPayload,
  resolveApiBaseUrl,
  getInstallationId,
  markSessionRecorded,
  DEFAULT_TIMEOUT_MS,
  fetchWithTimeout,
} from './backendApi'

// Storage Keys
export const TELEMETRY_QUEUE_STORAGE_KEY = 'gazemouse_offline_telemetry_queue_v1'
export const TELEMETRY_QUARANTINE_STORAGE_KEY = 'gazemouse_offline_telemetry_quarantine_v1'
export const TELEMETRY_DEAD_LETTER_STORAGE_KEY = 'gazemouse_telemetry_dead_letter_v1'

// Capacity Bounds
export const MAX_QUEUE_CAPACITY = 50
export const MAX_QUARANTINE_CAPACITY = 5
export const MAX_DEAD_LETTER_CAPACITY = 20

export type FailureType = 'NETWORK' | 'SERVER'

export interface QueuedSessionRecord {
  session: GameSessionTelemetry
  installationId: string
  enqueuedAt: string
  attempts: number
  lastAttemptAt: string | null
  nextRetryAt: number
  lastError?: string | null
  lastFailureType?: FailureType | null
  status: 'PENDING' | 'TERMINAL_CONFLICT'
}

export interface QuarantinedCorruptRecord {
  id: string
  quarantinedAt: string
  rawContent: string
  error: string
  recoveredRecordsCount: number
}

export interface DeadLetterRecord {
  sessionId: string
  installationId: string
  gameId: string
  completionStatus: string
  score: number
  httpStatus: number
  rejectedAt: string
  errorMessage: string
}

export interface DrainResult {
  sent: number
  failed: number
  conflicts: number
  abortedByCircuitBreaker?: boolean
}

export interface DrainOptions {
  force?: boolean
  trigger?: 'ONLINE' | 'MANUAL' | 'STARTUP' | 'VISIBILITY'
}

/**
 * Generates an RFC 4122 compliant UUID v4 string.
 */
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

// In-flight sessions tracked across active drain and direct calls to avoid duplicate network requests
const inFlightSessions = new Set<string>()

export function isInFlight(sessionId: string): boolean {
  return inFlightSessions.has(sessionId)
}

export function markInFlight(sessionId: string): void {
  inFlightSessions.add(sessionId)
}

export function clearInFlight(sessionId: string): void {
  inFlightSessions.delete(sessionId)
}

export function clearInFlightForTest(): void {
  inFlightSessions.clear()
}

/**
 * Tracks if quarantine preservation failed for raw corrupt data in the primary key.
 * Used to block destructive overwrites if the quarantine copy could not be secured.
 */
let quarantineFailedForRaw: string | null = null

/**
 * Validates that an item has all required non-guessed session fields.
 */
function isValidQueuedSessionRecord(item: any): item is QueuedSessionRecord {
  if (!item || typeof item !== 'object') return false
  if (!item.session || typeof item.session !== 'object') return false
  const s = item.session
  return (
    typeof s.id === 'string' &&
    s.id.length > 0 &&
    typeof s.gameId === 'string' &&
    typeof s.completionStatus === 'string' &&
    typeof s.score === 'number' &&
    !isNaN(s.score) &&
    typeof s.startedAt === 'string' &&
    typeof s.endedAt === 'string' &&
    typeof s.durationSeconds === 'number' &&
    !isNaN(s.durationSeconds)
  )
}

/**
 * Conservatively attempts to recover valid records from a truncated or malformed JSON array.
 * Never guesses missing fields or invents values.
 */
export function attemptConservativeRecovery(raw: string): QueuedSessionRecord[] {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('[')) {
    return []
  }

  // Scan backwards for valid JSON closing braces to salvage complete records before the truncation point
  let lastCloseBrace = trimmed.lastIndexOf('}')
  while (lastCloseBrace > 0) {
    const candidateJson = trimmed.slice(0, lastCloseBrace + 1) + ']'
    try {
      const parsed = JSON.parse(candidateJson)
      if (Array.isArray(parsed)) {
        const valid = parsed.filter(isValidQueuedSessionRecord)
        if (valid.length > 0) {
          return valid
        }
      }
    } catch {
      // Find previous closing brace
      lastCloseBrace = trimmed.lastIndexOf('}', lastCloseBrace - 1)
    }
  }
  return []
}

/**
 * Loads all quarantined corrupt telemetry records from storage.
 */
export function getQuarantinedRecords(): QuarantinedCorruptRecord[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(TELEMETRY_QUARANTINE_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Clears all quarantine records.
 */
export function clearQuarantine(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(TELEMETRY_QUARANTINE_STORAGE_KEY)
    }
  } catch {
    // Graceful error ignore
  }
}

/**
 * Safely preserves corrupt raw data under the quarantine storage key.
 * Returns true if the data was successfully preserved or was already quarantined.
 */
export function quarantineCorruptData(
  raw: string,
  errorMessage: string,
  recoveredCount: number
): boolean {
  try {
    if (typeof localStorage === 'undefined') return false

    const existing = getQuarantinedRecords()

    // Deduplication check: do not create duplicate quarantine entries for the exact same raw content
    if (existing.some((item) => item.rawContent === raw)) {
      return true
    }

    // Capacity bound: drop oldest quarantine entries if capacity is reached
    while (existing.length >= MAX_QUARANTINE_CAPACITY) {
      existing.shift()
    }

    const quarantineRecord: QuarantinedCorruptRecord = {
      id: generateUuid(),
      quarantinedAt: new Date().toISOString(),
      rawContent: raw,
      error: errorMessage.slice(0, 500),
      recoveredRecordsCount: recoveredCount,
    }

    existing.push(quarantineRecord)
    localStorage.setItem(TELEMETRY_QUARANTINE_STORAGE_KEY, JSON.stringify(existing))
    return true
  } catch (err) {
    console.warn('Failed to preserve corrupt queue data in quarantine:', err)
    return false
  }
}

/**
 * Loads dead-letter diagnostic records.
 */
export function getDeadLetterRecords(): DeadLetterRecord[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(TELEMETRY_DEAD_LETTER_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Clears dead-letter diagnostic records.
 */
export function clearDeadLetterRecords(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(TELEMETRY_DEAD_LETTER_STORAGE_KEY)
    }
  } catch {
    // Graceful ignore
  }
}

/**
 * Sanitizes error messages by stripping potential auth tokens, secrets, or biometric terms.
 */
function sanitizeErrorMessage(msg: string): string {
  if (!msg) return 'Unknown error'
  return msg
    .slice(0, 500)
    .replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, '[REDACTED_TOKEN]')
    .replace(/(password|secret|key|token)["']?\s*[:=]\s*["']?[^"',\s]+/gi, '$1=[REDACTED]')
}

/**
 * Records dead-letter diagnostics for terminally rejected sessions (HTTP 409, 400, 422).
 */
export function recordDeadLetterDiagnostic(record: DeadLetterRecord): boolean {
  try {
    if (typeof localStorage === 'undefined') return false

    const existing = getDeadLetterRecords()
    while (existing.length >= MAX_DEAD_LETTER_CAPACITY) {
      existing.shift()
    }

    existing.push({
      ...record,
      errorMessage: sanitizeErrorMessage(record.errorMessage),
    })

    localStorage.setItem(TELEMETRY_DEAD_LETTER_STORAGE_KEY, JSON.stringify(existing))
    return true
  } catch (err) {
    console.warn('Failed to record dead-letter diagnostic:', err)
    return false
  }
}

/**
 * Calculates exponential backoff with optional jitter.
 * Base delay: 2,000ms. Maximum delay: 300,000ms (5 minutes).
 */
export function calculateBackoffMs(attempts: number, includeJitter: boolean = true): number {
  const BASE_DELAY_MS = 2000
  const MAX_DELAY_MS = 300000
  const boundedAttempts = Math.max(0, Math.min(20, attempts))
  const expDelay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * Math.pow(2, boundedAttempts))
  const jitter = includeJitter ? Math.floor(Math.random() * 1000) : 0
  return expDelay + jitter
}

/**
 * Loads and validates queued telemetry sessions from persistent browser storage.
 * Gracefully handles missing storage, corrupted JSON, and invalid shapes.
 * Automatically quarantines corrupt data before returning any fallback.
 */
export function loadQueueFromStorage(): QueuedSessionRecord[] {
  try {
    if (typeof localStorage === 'undefined') {
      return []
    }
    const raw = localStorage.getItem(TELEMETRY_QUEUE_STORAGE_KEY)
    if (!raw) {
      quarantineFailedForRaw = null
      return []
    }

    let parsed: any
    try {
      parsed = JSON.parse(raw)
    } catch (parseErr: any) {
      console.warn('Telemetry queue corrupt JSON in localStorage. Initiating quarantine & conservative recovery.')
      const errDescription = `${parseErr?.name || 'SyntaxError'}: ${parseErr?.message || 'Invalid JSON'}`
      const recovered = attemptConservativeRecovery(raw)
      const quarantined = quarantineCorruptData(raw, errDescription, recovered.length)

      if (!quarantined) {
        // Quarantine storage failed: flag this raw string to prevent destructive overwrite in saveQueueToStorage
        quarantineFailedForRaw = raw
      } else {
        quarantineFailedForRaw = null
      }

      if (recovered.length > 0 && quarantined) {
        // Recovered records can be safely written back
        saveQueueToStorage(recovered)
        return recovered
      }

      return recovered
    }

    if (!Array.isArray(parsed)) {
      console.warn('Telemetry queue in localStorage is not an array. Initiating quarantine.')
      const quarantined = quarantineCorruptData(raw, 'Expected array, received object/primitive', 0)
      if (!quarantined) {
        quarantineFailedForRaw = raw
      } else {
        quarantineFailedForRaw = null
      }
      return []
    }

    quarantineFailedForRaw = null
    return parsed.filter(isValidQueuedSessionRecord)
  } catch (err) {
    console.warn('Failed to read telemetry queue from localStorage:', err)
    return []
  }
}

/**
 * Persists queued telemetry sessions to browser storage with QuotaExceededError protection.
 * Refuses to overwrite the primary key if corrupt data was detected and quarantine preservation failed.
 */
export function saveQueueToStorage(queue: QueuedSessionRecord[]): boolean {
  try {
    if (typeof localStorage === 'undefined') {
      return false
    }

    // Safety guard: do not overwrite the primary key if quarantine of corrupt data failed
    if (quarantineFailedForRaw !== null) {
      const currentRaw = localStorage.getItem(TELEMETRY_QUEUE_STORAGE_KEY)
      if (currentRaw === quarantineFailedForRaw) {
        console.warn('Refusing to overwrite telemetry queue: quarantine preservation of corrupt data failed.')
        return false
      }
    }

    localStorage.setItem(TELEMETRY_QUEUE_STORAGE_KEY, JSON.stringify(queue))
    return true
  } catch (err: any) {
    const isQuotaError =
      err?.name === 'QuotaExceededError' ||
      err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err?.code === 22 ||
      err?.code === 1014

    if (isQuotaError && queue.length > 1) {
      try {
        // Evict oldest entries when storage quota is reached
        const reduced = queue.slice(Math.ceil(queue.length / 2))
        localStorage.setItem(TELEMETRY_QUEUE_STORAGE_KEY, JSON.stringify(reduced))
        return true
      } catch {
        return false
      }
    }
    return false
  }
}

/**
 * Capacity info helper.
 */
export function getQueueCapacityInfo(): {
  count: number
  max: number
  isFull: boolean
  hasAvailableCapacity: boolean
} {
  const count = getQueueLength()
  return {
    count,
    max: MAX_QUEUE_CAPACITY,
    isFull: count >= MAX_QUEUE_CAPACITY,
    hasAvailableCapacity: count < MAX_QUEUE_CAPACITY,
  }
}

/**
 * Enqueues a game session into durable persistent storage.
 * Enforces strict capacity management without blindly evicting valid completed sessions:
 * 1. Deduplicates existing session IDs.
 * 2. If full, purges terminal conflicts or zero-score abandoned sessions with high failures.
 * 3. If capacity remains exhausted, safely rejects the new enqueue and returns false.
 * NEVER stores biometric or raw camera data.
 */
export function enqueueSession(
  session: GameSessionTelemetry,
  installationId?: string
): boolean {
  try {
    const queue = loadQueueFromStorage()

    // Deduplication check: if session is already queued, update metrics without resetting attempt count
    const existingIndex = queue.findIndex((item) => item.session.id === session.id)
    if (existingIndex >= 0) {
      queue[existingIndex].session = {
        ...queue[existingIndex].session,
        ...session,
      }
      return saveQueueToStorage(queue)
    }

    // Capacity management:
    if (queue.length >= MAX_QUEUE_CAPACITY) {
      // Step 1: Remove any records marked TERMINAL_CONFLICT (diagnostics are in dead letter)
      const conflictIndex = queue.findIndex((item) => item.status === 'TERMINAL_CONFLICT')
      if (conflictIndex >= 0) {
        queue.splice(conflictIndex, 1)
      } else {
        // Step 2: Remove any zero-score ABANDONED / INTERRUPTED session with attempts >= 2
        const lowValueIndex = queue.findIndex(
          (item) =>
            (item.session.completionStatus === 'ABANDONED' || item.session.completionStatus === 'INTERRUPTED') &&
            item.session.score === 0 &&
            item.attempts >= 2
        )
        if (lowValueIndex >= 0) {
          queue.splice(lowValueIndex, 1)
        } else {
          // Step 3: Capacity exhausted with valid sessions - safely reject new enqueue
          console.warn('Telemetry queue capacity reached. Rejecting new session to protect existing valid records.')
          return false
        }
      }
    }

    // Strict field segregation and sanitization: zero biometric data
    const sanitizedSession: GameSessionTelemetry = {
      id: session.id,
      gameId: session.gameId,
      gameMode: session.gameMode ?? null,
      completionStatus: session.completionStatus,
      score: session.score,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationSeconds: session.durationSeconds,
      coinsCollected: session.coinsCollected ?? null,
      distancePixels: session.distancePixels ?? null,
      speedPxPerSec: session.speedPxPerSec ?? null,
      distanceMeters: session.distanceMeters ?? null,
      speedMPerSec: session.speedMPerSec ?? null,
      movesMade: session.movesMade ?? null,
      movesRemaining: session.movesRemaining ?? null,
      matchesCount: session.matchesCount ?? null,
      targetScore: session.targetScore ?? null,
      isWin: session.isWin ?? null,
    }

    const record: QueuedSessionRecord = {
      session: sanitizedSession,
      installationId: installationId || getInstallationId(),
      enqueuedAt: new Date().toISOString(),
      attempts: 0,
      lastAttemptAt: null,
      nextRetryAt: Date.now(),
      lastFailureType: null,
      status: 'PENDING',
    }

    queue.push(record)
    return saveQueueToStorage(queue)
  } catch (err) {
    console.warn('Failed to enqueue telemetry session:', err)
    return false
  }
}

/**
 * Removes a session record from persistent storage.
 */
export function removeQueuedSession(sessionId: string): void {
  try {
    const queue = loadQueueFromStorage()
    const updated = queue.filter((item) => item.session.id !== sessionId)
    saveQueueToStorage(updated)
  } catch (err) {
    console.warn(`Failed to remove session ${sessionId} from queue:`, err)
  }
}

/**
 * Updates a queued session record atomically in persistent storage.
 */
export function updateQueuedSession(
  sessionId: string,
  updater: (item: QueuedSessionRecord) => QueuedSessionRecord
): void {
  try {
    const queue = loadQueueFromStorage()
    const index = queue.findIndex((item) => item.session.id === sessionId)
    if (index >= 0) {
      queue[index] = updater(queue[index])
      saveQueueToStorage(queue)
    }
  } catch (err) {
    console.warn(`Failed to update session ${sessionId} in queue:`, err)
  }
}

/**
 * Marks a queued session as a terminal conflict to prevent retry loops.
 */
export function markTerminalConflict(sessionId: string, reason?: string): void {
  updateQueuedSession(sessionId, (rec) => ({
    ...rec,
    status: 'TERMINAL_CONFLICT',
    lastError: reason || 'Terminal conflict',
  }))
}

/**
 * Returns all currently queued telemetry records.
 */
export function getQueuedSessions(): QueuedSessionRecord[] {
  return loadQueueFromStorage()
}

/**
 * Returns the current queue length.
 */
export function getQueueLength(): number {
  return loadQueueFromStorage().length
}

/**
 * Clears all entries from the persistent telemetry queue.
 */
export function clearQueue(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(TELEMETRY_QUEUE_STORAGE_KEY)
    }
  } catch (err) {
    console.warn('Failed to clear telemetry queue:', err)
  }
}

// Active drain promise for concurrency control across multiple calls
let activeDrainPromise: Promise<DrainResult> | null = null

export function isDrainInProgress(): boolean {
  return activeDrainPromise !== null
}

/**
 * Internal worker that processes queued sessions sequentially.
 * Implements a 2-consecutive-network-failure circuit breaker to prevent long timeout waterfalls.
 * Captures dead-letter diagnostics on terminal rejections (HTTP 409, 400, 422).
 */
async function drainQueueInternal(options: DrainOptions): Promise<DrainResult> {
  const result: DrainResult = { sent: 0, failed: 0, conflicts: 0, abortedByCircuitBreaker: false }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return result
  }

  const initialQueue = loadQueueFromStorage()
  if (initialQueue.length === 0) {
    return result
  }

  const now = Date.now()
  let consecutiveNetworkFailures = 0

  for (const candidate of initialQueue) {
    // If browser went offline mid-drain, pause processing
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      break
    }

    // Circuit Breaker: halt remaining items immediately after 2 consecutive network-level connection failures
    if (consecutiveNetworkFailures >= 2) {
      result.abortedByCircuitBreaker = true
      break
    }

    // Refresh candidate record from storage
    const currentQueue = loadQueueFromStorage()
    const item = currentQueue.find((q) => q.session.id === candidate.session.id)
    if (!item) {
      continue
    }

    // Terminal conflict records must not be retried
    if (item.status === 'TERMINAL_CONFLICT') {
      removeQueuedSession(item.session.id)
      result.conflicts++
      continue
    }

    // Selective Retry Timing:
    // - If triggered by ONLINE event: retry items that failed due to NETWORK, but respect backoff for SERVER 5xx failures.
    // - If force === true (manual force): bypass backoff for all items.
    // - Otherwise: respect item.nextRetryAt.
    if (!options.force) {
      if (options.trigger === 'ONLINE') {
        if (item.lastFailureType === 'SERVER' && item.nextRetryAt && item.nextRetryAt > now) {
          continue
        }
      } else if (item.nextRetryAt && item.nextRetryAt > now) {
        continue
      }
    }

    // Prevent duplicate in-flight requests for the same session ID
    if (isInFlight(item.session.id)) {
      continue
    }

    markInFlight(item.session.id)

    try {
      const payload = buildSessionPayload(item.session)
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Installation-Id': item.installationId || getInstallationId(),
      }

      const response = await fetchWithTimeout(
        `${resolveApiBaseUrl()}/sessions`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        },
        DEFAULT_TIMEOUT_MS
      )

      if (response.status === 201 || response.status === 200) {
        // Success (201 Created or 200 OK replay): remove from queue and record
        consecutiveNetworkFailures = 0
        removeQueuedSession(item.session.id)
        markSessionRecorded(item.session.id)
        result.sent++
      } else if (response.status === 409 || response.status === 400 || response.status === 422) {
        // Terminal rejection: capture diagnostic details safely
        consecutiveNetworkFailures = 0
        let errorBody = ''
        try {
          errorBody = await response.text()
        } catch {
          errorBody = 'Failed to read response body'
        }

        recordDeadLetterDiagnostic({
          sessionId: item.session.id,
          installationId: item.installationId,
          gameId: item.session.gameId,
          completionStatus: item.session.completionStatus,
          score: item.session.score,
          httpStatus: response.status,
          rejectedAt: new Date().toISOString(),
          errorMessage: errorBody,
        })

        removeQueuedSession(item.session.id)
        if (response.status === 409) {
          markSessionRecorded(item.session.id)
        }
        result.conflicts++
      } else if (response.status >= 500 || response.status === 429) {
        // HTTP 5xx server failure or 429 rate limit: retryable server error, NOT a network connection failure
        const attempts = (item.attempts || 0) + 1
        updateQueuedSession(item.session.id, (rec) => ({
          ...rec,
          attempts,
          lastAttemptAt: new Date().toISOString(),
          nextRetryAt: Date.now() + calculateBackoffMs(attempts),
          lastError: `HTTP ${response.status}`,
          lastFailureType: 'SERVER',
        }))
        result.failed++
      } else {
        // Non-retryable 4xx client errors (404, 405, 403, etc.): prune as terminal
        consecutiveNetworkFailures = 0
        let errorBody = ''
        try {
          errorBody = await response.text()
        } catch {
          errorBody = `HTTP ${response.status}`
        }

        recordDeadLetterDiagnostic({
          sessionId: item.session.id,
          installationId: item.installationId,
          gameId: item.session.gameId,
          completionStatus: item.session.completionStatus,
          score: item.session.score,
          httpStatus: response.status,
          rejectedAt: new Date().toISOString(),
          errorMessage: errorBody,
        })

        removeQueuedSession(item.session.id)
        result.conflicts++
      }
    } catch (err: any) {
      // Genuine network-level failure (fetch abort, timeout, connection lost)
      consecutiveNetworkFailures++
      const attempts = (item.attempts || 0) + 1
      updateQueuedSession(item.session.id, (rec) => ({
        ...rec,
        attempts,
        lastAttemptAt: new Date().toISOString(),
        nextRetryAt: Date.now() + calculateBackoffMs(attempts),
        lastError: err?.message || 'Network error',
        lastFailureType: 'NETWORK',
      }))
      result.failed++

      if (consecutiveNetworkFailures >= 2) {
        result.abortedByCircuitBreaker = true
        break
      }
    } finally {
      clearInFlight(item.session.id)
    }
  }

  return result
}

/**
 * Initiates queue draining with concurrency locking.
 * Multiple simultaneous calls share the active drain promise.
 */
export function drainQueue(options?: boolean | DrainOptions): Promise<DrainResult> {
  const normalizedOptions: DrainOptions =
    typeof options === 'boolean' ? { force: options } : options || {}

  if (activeDrainPromise) {
    return activeDrainPromise
  }

  activeDrainPromise = drainQueueInternal(normalizedOptions).finally(() => {
    activeDrainPromise = null
  })

  return activeDrainPromise
}

let cleanupFn: (() => void) | null = null

/**
 * Initializes automatic background telemetry queue processing:
 * - Triggers startup drain if online
 * - Listens for browser 'online' event with selective retry (retries network failures, preserves server 5xx backoff)
 * - Listens for document 'visibilitychange' to drain when tab becomes visible
 * Returns a cleanup unregister function.
 */
export function initTelemetryQueue(): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  if (cleanupFn) {
    return cleanupFn
  }

  const handleOnline = () => {
    drainQueue({ force: false, trigger: 'ONLINE' }).catch(() => {})
  }

  const handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      drainQueue({ trigger: 'VISIBILITY' }).catch(() => {})
    }
  }

  window.addEventListener('online', handleOnline)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  // Initial startup drain
  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    drainQueue({ trigger: 'STARTUP' }).catch(() => {})
  }

  cleanupFn = () => {
    window.removeEventListener('online', handleOnline)
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    cleanupFn = null
  }

  return cleanupFn
}

/**
 * Resets queue state for testing.
 */
export function resetTelemetryQueueStateForTest(): void {
  if (cleanupFn) {
    cleanupFn()
  }
  activeDrainPromise = null
  inFlightSessions.clear()
  quarantineFailedForRaw = null
  clearQueue()
  clearQuarantine()
  clearDeadLetterRecords()
}

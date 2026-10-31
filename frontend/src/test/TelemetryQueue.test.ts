import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  TELEMETRY_QUEUE_STORAGE_KEY,
  TELEMETRY_QUARANTINE_STORAGE_KEY,
  TELEMETRY_DEAD_LETTER_STORAGE_KEY,
  MAX_QUEUE_CAPACITY,
  MAX_QUARANTINE_CAPACITY,
  MAX_DEAD_LETTER_CAPACITY,
  enqueueSession,
  getQueuedSessions,
  getQueueLength,
  removeQueuedSession,
  markTerminalConflict,
  clearQueue,
  clearQuarantine,
  clearDeadLetterRecords,
  calculateBackoffMs,
  drainQueue,
  initTelemetryQueue,
  isDrainInProgress,
  resetTelemetryQueueStateForTest,
  loadQueueFromStorage,
  saveQueueToStorage,
  getQuarantinedRecords,
  getDeadLetterRecords,
  getQueueCapacityInfo,
  attemptConservativeRecovery,
  type QueuedSessionRecord,
} from '../services/telemetryQueue'
import {
  recordGameSession,
  recordGameSessionOnUnload,
  clearRecordedSessionsForTest,
  isSessionRecorded,
  type GameSessionTelemetry,
} from '../services/backendApi'

describe('Milestone 6C & 6C.1 — Hardened Persistent Telemetry Queue', () => {
  const originalFetch = global.fetch
  const originalOnLine = navigator.onLine

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    resetTelemetryQueueStateForTest()
    clearRecordedSessionsForTest()
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
    resetTelemetryQueueStateForTest()
    clearRecordedSessionsForTest()
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      configurable: true,
      writable: true,
    })
  })

  const sampleSession: GameSessionTelemetry = {
    id: '11111111-2222-3333-4444-555555555555',
    gameId: 'GAZE_RUNNER',
    gameMode: null,
    completionStatus: 'COMPLETED',
    score: 350,
    startedAt: '2026-10-31T10:00:00.000Z',
    endedAt: '2026-10-31T10:01:00.000Z',
    durationSeconds: 60,
    coinsCollected: 15,
    distancePixels: 1200,
    speedPxPerSec: 250.5,
  }

  describe('1. Storage Mechanics & Payload Integrity', () => {
    it('enqueues a session into localStorage under the versioned key', () => {
      expect(getQueueLength()).toBe(0)

      const success = enqueueSession(sampleSession, 'guest-inst-123')
      expect(success).toBe(true)
      expect(getQueueLength()).toBe(1)

      const raw = localStorage.getItem(TELEMETRY_QUEUE_STORAGE_KEY)
      expect(raw).not.toBeNull()
      expect(raw).toContain(sampleSession.id)
      expect(raw).toContain('guest-inst-123')
    })

    it('preserves all telemetry metrics, timestamps, and UUIDs without mutation', () => {
      enqueueSession(sampleSession, 'guest-inst-456')

      const [record] = getQueuedSessions()
      expect(record.session.id).toBe('11111111-2222-3333-4444-555555555555')
      expect(record.session.gameId).toBe('GAZE_RUNNER')
      expect(record.session.completionStatus).toBe('COMPLETED')
      expect(record.session.score).toBe(350)
      expect(record.session.startedAt).toBe('2026-10-31T10:00:00.000Z')
      expect(record.session.endedAt).toBe('2026-10-31T10:01:00.000Z')
      expect(record.session.durationSeconds).toBe(60)
      expect(record.session.coinsCollected).toBe(15)
      expect(record.session.distancePixels).toBe(1200)
      expect(record.session.speedPxPerSec).toBe(250.5)
      expect(record.installationId).toBe('guest-inst-456')
      expect(record.attempts).toBe(0)
      expect(record.status).toBe('PENDING')
    })

    it('deduplicates re-enqueued sessions by updating metrics without creating duplicates', () => {
      enqueueSession(sampleSession)
      expect(getQueueLength()).toBe(1)

      const updatedSession: GameSessionTelemetry = {
        ...sampleSession,
        score: 500,
        coinsCollected: 25,
      }

      enqueueSession(updatedSession)
      expect(getQueueLength()).toBe(1)

      const [record] = getQueuedSessions()
      expect(record.session.score).toBe(500)
      expect(record.session.coinsCollected).toBe(25)
    })

    it('handles QuotaExceededError during storage writes by halving queue', () => {
      const originalSetItem = localStorage.setItem
      let throwQuota = true

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
        if (throwQuota) {
          throwQuota = false
          const err = new Error('QuotaExceededError')
          err.name = 'QuotaExceededError'
          throw err
        }
        return originalSetItem.call(this, key, value)
      })

      const queue: QueuedSessionRecord[] = [
        { session: { ...sampleSession, id: 'id-1' }, installationId: 'inst-1', enqueuedAt: '', attempts: 0, lastAttemptAt: null, nextRetryAt: 0, status: 'PENDING' },
        { session: { ...sampleSession, id: 'id-2' }, installationId: 'inst-1', enqueuedAt: '', attempts: 0, lastAttemptAt: null, nextRetryAt: 0, status: 'PENDING' },
        { session: { ...sampleSession, id: 'id-3' }, installationId: 'inst-1', enqueuedAt: '', attempts: 0, lastAttemptAt: null, nextRetryAt: 0, status: 'PENDING' },
        { session: { ...sampleSession, id: 'id-4' }, installationId: 'inst-1', enqueuedAt: '', attempts: 0, lastAttemptAt: null, nextRetryAt: 0, status: 'PENDING' },
      ]

      const saved = saveQueueToStorage(queue)
      expect(saved).toBe(true)
      expect(getQueueLength()).toBeLessThan(4)
    })

    it('removeQueuedSession and clearQueue work as expected', () => {
      enqueueSession({ ...sampleSession, id: 'session-a' })
      enqueueSession({ ...sampleSession, id: 'session-b' })
      expect(getQueueLength()).toBe(2)

      removeQueuedSession('session-a')
      expect(getQueueLength()).toBe(1)
      expect(getQueuedSessions()[0].session.id).toBe('session-b')

      clearQueue()
      expect(getQueueLength()).toBe(0)
    })
  })

  describe('2. Corrupt Queue Protection & Quarantine (Fix 1)', () => {
    it('preserves exact original malformed raw string in collision-safe quarantine storage', () => {
      const corruptRaw = '[{"session":{"id":"corrupt-1","gameId":"GAZE_RUNNER"},'
      localStorage.setItem(TELEMETRY_QUEUE_STORAGE_KEY, corruptRaw)

      const queue = loadQueueFromStorage()
      expect(queue).toEqual([])

      const quarantined = getQuarantinedRecords()
      expect(quarantined).toHaveLength(1)
      expect(quarantined[0].rawContent).toBe(corruptRaw)
      expect(quarantined[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      expect(quarantined[0].error).toContain('SyntaxError')
    })

    it('subsequent enqueue cannot silently overwrite corrupt data without quarantine protection', () => {
      const corruptRaw = '{totally-broken-json'
      localStorage.setItem(TELEMETRY_QUEUE_STORAGE_KEY, corruptRaw)

      loadQueueFromStorage()
      expect(getQuarantinedRecords()[0].rawContent).toBe(corruptRaw)

      // Subsequent enqueue writes new record to primary queue, but quarantine copy remains intact!
      const ok = enqueueSession(sampleSession)
      expect(ok).toBe(true)

      const quarantined = getQuarantinedRecords()
      expect(quarantined).toHaveLength(1)
      expect(quarantined[0].rawContent).toBe(corruptRaw)

      // Primary queue now has the new record
      expect(getQueueLength()).toBe(1)
      expect(getQueuedSessions()[0].session.id).toBe(sampleSession.id)
    })

    it('reinitialization does not generate unlimited duplicate quarantine entries for the same corrupt payload', () => {
      const corruptRaw = '{syntax-error-json'
      localStorage.setItem(TELEMETRY_QUEUE_STORAGE_KEY, corruptRaw)

      // Load multiple times
      loadQueueFromStorage()
      loadQueueFromStorage()
      loadQueueFromStorage()

      const quarantined = getQuarantinedRecords()
      // Exactly 1 quarantine entry, no duplicate spamming
      expect(quarantined).toHaveLength(1)
    })

    it('conservatively recovers valid complete records from truncated JSON arrays without inventing values', () => {
      const validRecord1: QueuedSessionRecord = {
        session: {
          id: '11111111-1111-1111-1111-111111111111',
          gameId: 'GAZE_RUNNER',
          completionStatus: 'COMPLETED',
          score: 250,
          startedAt: '2026-10-31T09:00:00Z',
          endedAt: '2026-10-31T09:01:00Z',
          durationSeconds: 60,
        },
        installationId: 'inst-1',
        enqueuedAt: '2026-10-31T09:01:00Z',
        attempts: 0,
        lastAttemptAt: null,
        nextRetryAt: 0,
        status: 'PENDING',
      }

      // JSON string that has 1 complete valid record and a truncated second record
      const truncatedJson = `[${JSON.stringify(validRecord1)},{"session":{"id":"22222222-`
      localStorage.setItem(TELEMETRY_QUEUE_STORAGE_KEY, truncatedJson)

      const recovered = loadQueueFromStorage()
      expect(recovered).toHaveLength(1)
      expect(recovered[0].session.id).toBe(validRecord1.session.id)
      expect(recovered[0].session.score).toBe(250)

      // The full raw string was also preserved in quarantine
      const quarantined = getQuarantinedRecords()
      expect(quarantined).toHaveLength(1)
      expect(quarantined[0].recoveredRecordsCount).toBe(1)
      expect(quarantined[0].rawContent).toBe(truncatedJson)
    })

    it('refuses destructive replacement of original corrupt queue if quarantine saving fails', () => {
      const corruptRaw = '{critical-data-that-cannot-be-quarantined'
      localStorage.setItem(TELEMETRY_QUEUE_STORAGE_KEY, corruptRaw)

      // Simulate failure of quarantine write (e.g. storage error or quota error)
      const originalSetItem = localStorage.setItem
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
        if (key === TELEMETRY_QUARANTINE_STORAGE_KEY) {
          throw new Error('QuotaExceededError: quarantine storage full')
        }
        return originalSetItem.call(this, key, value)
      })

      // Load will detect corruption, attempt quarantine (which fails), and not overwrite primary
      const queue = loadQueueFromStorage()
      expect(queue).toEqual([])

      // Attempting to enqueue now must fail rather than destroy the only existing copy
      const enqueued = enqueueSession(sampleSession)
      expect(enqueued).toBe(false)

      // The original corrupt raw data is still present in the primary key!
      expect(localStorage.getItem(TELEMETRY_QUEUE_STORAGE_KEY)).toBe(corruptRaw)
    })

    it('bounds quarantine capacity to MAX_QUARANTINE_CAPACITY (5)', () => {
      for (let i = 0; i < 7; i++) {
        localStorage.setItem(TELEMETRY_QUEUE_STORAGE_KEY, `{bad-json-${i}`)
        loadQueueFromStorage()
      }

      const quarantined = getQuarantinedRecords()
      expect(quarantined.length).toBeLessThanOrEqual(MAX_QUARANTINE_CAPACITY)
    })
  })

  describe('3. Drain Circuit Breaker (Fix 2)', () => {
    it('halts drain pass after 2 consecutive network failures, leaving remaining items intact', async () => {
      // Enqueue 5 sessions
      for (let i = 1; i <= 5; i++) {
        enqueueSession({
          ...sampleSession,
          id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
          score: i * 100,
        })
      }
      expect(getQueueLength()).toBe(5)

      let networkCallCount = 0
      global.fetch = vi.fn().mockImplementation(() => {
        networkCallCount++
        return Promise.reject(new Error('AbortError: connection timeout'))
      })

      const result = await drainQueue()
      // Circuit breaker trips after 2 consecutive failures!
      expect(networkCallCount).toBe(2)
      expect(result.abortedByCircuitBreaker).toBe(true)
      expect(result.failed).toBe(2)
      expect(result.sent).toBe(0)

      // All 5 items remain in storage!
      expect(getQueueLength()).toBe(5)
      const queue = getQueuedSessions()
      // Items 1 and 2 had attempts incremented
      expect(queue[0].attempts).toBe(1)
      expect(queue[1].attempts).toBe(1)
      // Items 3, 4, 5 were unattempted (attempts = 0)
      expect(queue[2].attempts).toBe(0)
      expect(queue[3].attempts).toBe(0)
      expect(queue[4].attempts).toBe(0)
    })

    it('resets consecutive network failure counter upon a successful response', async () => {
      for (let i = 1; i <= 4; i++) {
        enqueueSession({
          ...sampleSession,
          id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
          score: i * 100,
        })
      }

      let callIndex = 0
      global.fetch = vi.fn().mockImplementation(() => {
        callIndex++
        if (callIndex === 1) {
          // Item 1: Network failure (consecutive = 1)
          return Promise.reject(new Error('TypeError: Failed to fetch'))
        }
        if (callIndex === 2) {
          // Item 2: Success (consecutive resets to 0!)
          return Promise.resolve({ status: 201, ok: true } as Response)
        }
        if (callIndex === 3) {
          // Item 3: Network failure (consecutive = 1)
          return Promise.reject(new Error('TypeError: Failed to fetch'))
        }
        // Item 4: Success
        return Promise.resolve({ status: 200, ok: true } as Response)
      })

      const result = await drainQueue({ force: true })
      // Because success reset the counter, all 4 were attempted and circuit breaker did NOT trip!
      expect(callIndex).toBe(4)
      expect(result.abortedByCircuitBreaker).toBe(false)
      expect(result.sent).toBe(2)
      expect(result.failed).toBe(2)
    })

    it('does NOT confuse HTTP 500/503 server responses with network-level connection failures', async () => {
      enqueueSession({ ...sampleSession, id: 'session-1' })
      enqueueSession({ ...sampleSession, id: 'session-2' })
      enqueueSession({ ...sampleSession, id: 'session-3' })

      let callCount = 0
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++
        // Returns HTTP 503 from an active server
        return Promise.resolve({ status: 503, ok: false } as Response)
      })

      const result = await drainQueue({ force: true })
      // Server responses do not trip network connection circuit breaker
      expect(callCount).toBe(3)
      expect(result.failed).toBe(3)
      expect(result.abortedByCircuitBreaker).toBe(false)
    })
  })

  describe('4. Terminal Rejection Diagnostics (Fix 3)', () => {
    it('HTTP 409: captures and stores dead-letter diagnostic details without crashing', async () => {
      enqueueSession(sampleSession)

      const conflictErrorBody = JSON.stringify({
        status: 409,
        error: 'Conflict',
        message: 'Session ID already exists with a different payload.',
      })

      global.fetch = vi.fn().mockResolvedValue({
        status: 409,
        ok: false,
        text: async () => conflictErrorBody,
      } as Response)

      const result = await drainQueue()
      expect(result.conflicts).toBe(1)
      expect(getQueueLength()).toBe(0)

      // Verified: dead letter contains the diagnostic details
      const deadLetters = getDeadLetterRecords()
      expect(deadLetters).toHaveLength(1)
      expect(deadLetters[0].sessionId).toBe(sampleSession.id)
      expect(deadLetters[0].httpStatus).toBe(409)
      expect(deadLetters[0].errorMessage).toContain('different payload')
      expect(deadLetters[0].rejectedAt).toBeDefined()
    })

    it('HTTP 400 & 422: captures validation error diagnostics and prunes record from queue', async () => {
      enqueueSession(sampleSession)

      const validationErrorBody = JSON.stringify({
        status: 400,
        error: 'Bad Request',
        validationErrors: { durationSeconds: 'must be at most 86400' },
      })

      global.fetch = vi.fn().mockResolvedValue({
        status: 400,
        ok: false,
        text: async () => validationErrorBody,
      } as Response)

      const result = await drainQueue()
      expect(result.conflicts).toBe(1)
      expect(getQueueLength()).toBe(0)

      const deadLetters = getDeadLetterRecords()
      expect(deadLetters).toHaveLength(1)
      expect(deadLetters[0].httpStatus).toBe(400)
      expect(deadLetters[0].errorMessage).toContain('must be at most 86400')
    })

    it('handles malformed error response body without breaking queue drain', async () => {
      enqueueSession(sampleSession)

      global.fetch = vi.fn().mockResolvedValue({
        status: 422,
        ok: false,
        text: () => Promise.reject(new Error('Body stream closed abruptly')),
      } as Response)

      const result = await drainQueue()
      expect(result.conflicts).toBe(1)
      expect(getQueueLength()).toBe(0)

      const deadLetters = getDeadLetterRecords()
      expect(deadLetters).toHaveLength(1)
      expect(deadLetters[0].errorMessage).toBe('Failed to read response body')
    })

    it('sanitizes tokens and passwords from error messages in dead letter records', () => {
      const contaminatedMsg = 'Error at /sessions: Bearer abc123def456 secret="supersecret" password=mysecret'
      const sanitized = getDeadLetterRecords()
      expect(sanitized).toHaveLength(0)

      enqueueSession(sampleSession)

      global.fetch = vi.fn().mockResolvedValue({
        status: 409,
        ok: false,
        text: async () => contaminatedMsg,
      } as Response)

      return drainQueue().then(() => {
        const records = getDeadLetterRecords()
        expect(records).toHaveLength(1)
        expect(records[0].errorMessage).not.toContain('abc123def456')
        expect(records[0].errorMessage).not.toContain('supersecret')
        expect(records[0].errorMessage).not.toContain('mysecret')
        expect(records[0].errorMessage).toContain('[REDACTED_TOKEN]')
      })
    })

    it('bounds dead letter diagnostic storage to MAX_DEAD_LETTER_CAPACITY (20)', async () => {
      for (let i = 0; i < 25; i++) {
        enqueueSession({
          ...sampleSession,
          id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
        })
      }

      global.fetch = vi.fn().mockResolvedValue({
        status: 400,
        ok: false,
        text: async () => 'Validation error',
      } as Response)

      await drainQueue({ force: true })

      const deadLetters = getDeadLetterRecords()
      expect(deadLetters.length).toBeLessThanOrEqual(MAX_DEAD_LETTER_CAPACITY)
    })
  })

  describe('5. Retry Timing & Selective Backoff (Fix 4)', () => {
    it('ONLINE event does NOT bypass exponential backoff for items that failed with HTTP 5xx', async () => {
      enqueueSession(sampleSession)

      // First drain fails with HTTP 500
      global.fetch = vi.fn().mockResolvedValue({ status: 500, ok: false } as Response)
      await drainQueue()

      const [record] = getQueuedSessions()
      expect(record.lastFailureType).toBe('SERVER')
      expect(record.attempts).toBe(1)
      expect(record.nextRetryAt).toBeGreaterThan(Date.now() + 1000)

      // Subsequent drain triggered by ONLINE event
      global.fetch = vi.fn() // Should not be called!
      const onlineResult = await drainQueue({ force: false, trigger: 'ONLINE' })

      // Server failure must respect its backoff window!
      expect(onlineResult.sent).toBe(0)
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('ONLINE event retries items that failed due to NETWORK connectivity', async () => {
      enqueueSession(sampleSession)

      // First drain fails with network failure
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
      await drainQueue()

      const [record] = getQueuedSessions()
      expect(record.lastFailureType).toBe('NETWORK')

      // Now online event fires: backend is reachable and accepts
      global.fetch = vi.fn().mockResolvedValue({ status: 201, ok: true } as Response)
      const onlineResult = await drainQueue({ force: false, trigger: 'ONLINE' })

      // Network failure is immediately retried on ONLINE trigger!
      expect(onlineResult.sent).toBe(1)
      expect(global.fetch).toHaveBeenCalled()
      expect(getQueueLength()).toBe(0)
    })

    it('manual force=true bypasses backoff for all items', async () => {
      enqueueSession(sampleSession)

      global.fetch = vi.fn().mockResolvedValue({ status: 500, ok: false } as Response)
      await drainQueue()

      global.fetch = vi.fn().mockResolvedValue({ status: 200, ok: true } as Response)
      const forceResult = await drainQueue({ force: true, trigger: 'MANUAL' })

      expect(forceResult.sent).toBe(1)
      expect(getQueueLength()).toBe(0)
    })
  })

  describe('6. Queue Capacity Policy (Fix 5)', () => {
    it('does NOT evict valid completed sessions when queue reaches capacity', () => {
      for (let i = 0; i < MAX_QUEUE_CAPACITY; i++) {
        const ok = enqueueSession({
          ...sampleSession,
          id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
          score: (i + 1) * 100,
          completionStatus: 'COMPLETED',
        })
        expect(ok).toBe(true)
      }

      expect(getQueueLength()).toBe(MAX_QUEUE_CAPACITY)
      expect(getQueueCapacityInfo().isFull).toBe(true)

      // The 51st session is a new valid session
      const ok51 = enqueueSession({
        ...sampleSession,
        id: '99999999-9999-9999-9999-999999999999',
        score: 9999,
      })

      // Must be safely rejected rather than destroying existing completed sessions!
      expect(ok51).toBe(false)
      expect(getQueueLength()).toBe(MAX_QUEUE_CAPACITY)

      // Session 0 (first completed session) was NOT evicted!
      const queue = getQueuedSessions()
      expect(queue[0].session.score).toBe(100)
    })

    it('evicts terminal conflict records first to make room for new sessions', () => {
      // Fill to capacity with 49 completed sessions and 1 terminal conflict
      for (let i = 0; i < MAX_QUEUE_CAPACITY - 1; i++) {
        enqueueSession({
          ...sampleSession,
          id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
          score: 100,
        })
      }
      enqueueSession({
        ...sampleSession,
        id: 'conflict-session-id',
        score: 50,
      })
      markTerminalConflict('conflict-session-id', 'Conflict')
      expect(getQueueLength()).toBe(MAX_QUEUE_CAPACITY)

      // Enqueue new session
      const ok = enqueueSession({
        ...sampleSession,
        id: 'new-valid-session',
        score: 800,
      })

      // Accepted by evicting the conflict record!
      expect(ok).toBe(true)
      expect(getQueueLength()).toBe(MAX_QUEUE_CAPACITY)
      const queue = getQueuedSessions()
      expect(queue.some((item) => item.session.id === 'conflict-session-id')).toBe(false)
      expect(queue.some((item) => item.session.id === 'new-valid-session')).toBe(true)
    })

    it('evicts zero-score abandoned sessions with high failures second to make room', () => {
      for (let i = 0; i < MAX_QUEUE_CAPACITY - 1; i++) {
        enqueueSession({
          ...sampleSession,
          id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
          score: 500,
        })
      }
      // Add a 0-score abandoned session with 3 failures
      enqueueSession({
        ...sampleSession,
        id: 'abandoned-zero-score',
        score: 0,
        completionStatus: 'ABANDONED',
      })
      const queue = getQueuedSessions()
      queue[queue.length - 1].attempts = 3
      saveQueueToStorage(queue)

      // Enqueue new session
      const ok = enqueueSession({
        ...sampleSession,
        id: 'valuable-new-session',
        score: 1000,
      })

      expect(ok).toBe(true)
      const updatedQueue = getQueuedSessions()
      expect(updatedQueue.some((item) => item.session.id === 'abandoned-zero-score')).toBe(false)
      expect(updatedQueue.some((item) => item.session.id === 'valuable-new-session')).toBe(true)
    })
  })

  describe('7. Concurrency Control & Application Triggers', () => {
    it('concurrent drainQueue calls coalesce into a single execution', async () => {
      enqueueSession(sampleSession)

      let resolveFetch: (val: any) => void
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve
      })

      global.fetch = vi.fn().mockImplementation(() => fetchPromise)

      const drain1 = drainQueue()
      const drain2 = drainQueue()

      expect(isDrainInProgress()).toBe(true)
      expect(drain1).toBe(drain2)

      resolveFetch!({ status: 201, ok: true })

      const [res1, res2] = await Promise.all([drain1, drain2])
      expect(res1).toEqual(res2)
      expect(res1.sent).toBe(1)
      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(isDrainInProgress()).toBe(false)
    })

    it('when navigator.onLine is false, recordGameSession and drainQueue fast-path without network call', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      global.fetch = vi.fn()

      const success = await recordGameSession(sampleSession)
      expect(success).toBe(false)
      expect(global.fetch).not.toHaveBeenCalled()
      expect(getQueueLength()).toBe(1)

      const drainResult = await drainQueue()
      expect(drainResult.sent).toBe(0)
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('recordGameSessionOnUnload safely enqueues session and initiates keepalive fetch', () => {
      global.fetch = vi.fn().mockResolvedValue({ status: 201, ok: true } as Response)

      const submitted = recordGameSessionOnUnload(sampleSession)
      expect(submitted).toBe(true)

      expect(getQueueLength()).toBe(1)
      expect(getQueuedSessions()[0].session.id).toBe(sampleSession.id)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions'),
        expect.objectContaining({
          method: 'POST',
          keepalive: true,
        })
      )
    })
  })

  describe('8. Zero Biometric Privacy Verification', () => {
    it('queued record contains only valid game metrics and strictly no biometric or camera data', () => {
      const contaminatedSession: any = {
        ...sampleSession,
        faceLandmarks: [{ x: 0.5, y: 0.5, z: 0.1 }],
        irisCoordinates: { left: [10, 20], right: [30, 40] },
        cameraFeedBlob: 'data:image/png;base64,invalidImageData',
        rawGazeStream: [{ x: 100, y: 200, time: 12345 }],
      }

      enqueueSession(contaminatedSession)

      const raw = localStorage.getItem(TELEMETRY_QUEUE_STORAGE_KEY)
      expect(raw).not.toBeNull()
      expect(raw).not.toContain('faceLandmarks')
      expect(raw).not.toContain('irisCoordinates')
      expect(raw).not.toContain('cameraFeedBlob')
      expect(raw).not.toContain('rawGazeStream')

      const [record] = getQueuedSessions()
      expect((record.session as any).faceLandmarks).toBeUndefined()
      expect((record.session as any).irisCoordinates).toBeUndefined()
      expect((record.session as any).cameraFeedBlob).toBeUndefined()
      expect((record.session as any).rawGazeStream).toBeUndefined()
    })
  })
})

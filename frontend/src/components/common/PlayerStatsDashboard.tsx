import React, { useState, useEffect } from 'react'
import { Card } from './Card'
import { Badge } from './Badge'
import { Button } from './Button'
import { fetchBackendStats, type BackendStats } from '../../services/backendApi'

type FilterGame = 'ALL' | 'GAZE_RUNNER' | 'GAZE_MATCH' | 'GAZE_3D_RUNNER'

export const PlayerStatsDashboard: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState<FilterGame>('ALL')
  const [stats, setStats] = useState<BackendStats | null>(null)
  const [isBackend, setIsBackend] = useState<boolean>(false)

  const [localScores, setLocalScores] = useState({
    runner: 0,
    runner3d: 0,
    match: 0,
  })

  // Read local storage high scores for offline fallback
  const refreshLocalScores = () => {
    try {
      const runner = parseInt(localStorage.getItem('gazemouse_runner_highscore_v1') || '0', 10) || 0
      const runner3d = parseInt(localStorage.getItem('gazemouse_runner3d_highscore_v1') || '0', 10) || 0
      const match = parseInt(localStorage.getItem('gazemouse_match_highscore_v1') || '0', 10) || 0
      setLocalScores({ runner, runner3d, match })
    } catch {
      // Storage unavailable fallback
    }
  }

  useEffect(() => {
    refreshLocalScores()
    let isMounted = true

    const gameIdParam = selectedFilter === 'ALL' ? undefined : selectedFilter

    fetchBackendStats(gameIdParam).then((res) => {
      if (!isMounted) return
      if (res) {
        setStats(res)
        setIsBackend(true)
      } else {
        setStats(null)
        setIsBackend(false)
      }
    })

    return () => {
      isMounted = false
    }
  }, [selectedFilter])

  const formatDuration = (totalSec: number): string => {
    if (totalSec <= 0) return '0s'
    const hours = Math.floor(totalSec / 3600)
    const minutes = Math.floor((totalSec % 3600) / 60)
    const seconds = totalSec % 60
    if (hours > 0) return `${hours}h ${minutes}m`
    if (minutes > 0) return `${minutes}m ${seconds}s`
    return `${seconds}s`
  }

  return (
    <Card variant="bordered" style={{ padding: '24px' }}>
      {/* Header and Source Status */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '1.35rem', color: 'var(--color-deep-blue)', margin: 0 }}>
              Gameplay Statistics & Telemetry
            </h2>
            {isBackend ? (
              <Badge status="success" size="sm">
                ● Synchronized with Backend
              </Badge>
            ) : (
              <Badge status="neutral" size="sm">
                ● Local Storage (Offline Mode)
              </Badge>
            )}
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            {isBackend
              ? 'Accurate aggregate metrics calculated exclusively from your completed guest game sessions.'
              : 'Backend currently unreachable. Showing local fallback high scores from your browser.'}
          </p>
        </div>

        {/* Filter Selection Buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(['ALL', 'GAZE_RUNNER', 'GAZE_MATCH', 'GAZE_3D_RUNNER'] as const).map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={selectedFilter === filter ? 'primary' : 'outline'}
              onClick={() => setSelectedFilter(filter)}
            >
              {filter === 'ALL'
                ? 'All Games'
                : filter === 'GAZE_RUNNER'
                ? 'Gaze Runner'
                : filter === 'GAZE_MATCH'
                ? 'Gaze Match'
                : '3D Runner'}
            </Button>
          ))}
        </div>
      </div>

      {/* Main Stats Grid */}
      {isBackend && stats ? (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '16px',
              marginBottom: '20px',
            }}
          >
            <div style={statBoxStyle}>
              <span style={statLabelStyle}>Total Sessions</span>
              <strong style={statValueStyle}>{stats.totalSessions}</strong>
            </div>

            <div style={statBoxStyle}>
              <span style={statLabelStyle}>Completed</span>
              <strong style={{ ...statValueStyle, color: 'var(--color-success)' }}>
                {stats.completedSessions}
              </strong>
            </div>

            <div style={statBoxStyle}>
              <span style={statLabelStyle}>Incomplete / Aborted</span>
              <strong style={{ ...statValueStyle, color: 'var(--color-text-muted)' }}>
                {stats.abandonedSessions + stats.interruptedSessions}
              </strong>
            </div>

            <div style={statBoxStyle}>
              <span style={statLabelStyle}>Play Time</span>
              <strong style={statValueStyle}>{formatDuration(stats.totalPlayTimeSeconds)}</strong>
            </div>

            <div style={statBoxStyle}>
              <span style={statLabelStyle}>High Score</span>
              <strong style={{ ...statValueStyle, color: 'var(--color-primary-blue)' }}>
                {stats.highScore}
              </strong>
            </div>

            <div style={statBoxStyle}>
              <span style={statLabelStyle}>Average Score</span>
              <strong style={statValueStyle}>{stats.averageScore.toFixed(1)}</strong>
            </div>
          </div>

          {/* Game-Specific Breakdown Cards */}
          {(stats.gazeRunner || stats.gaze3dRunner || stats.gazeMatch) && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '14px',
                borderTop: '1px solid var(--color-border)',
                paddingTop: '16px',
              }}
            >
              {stats.gazeRunner && (
                <div style={subCardStyle}>
                  <div style={{ fontWeight: 700, color: 'var(--color-deep-blue)', marginBottom: '6px' }}>
                    🏃 Gaze Runner (2D)
                  </div>
                  <div style={subMetricStyle}>Coins Collected: <strong>{stats.gazeRunner.totalCoinsCollected}</strong></div>
                  <div style={subMetricStyle}>Max Distance: <strong>{stats.gazeRunner.maxDistancePixels} px</strong></div>
                  <div style={subMetricStyle}>Top Speed: <strong>{stats.gazeRunner.maxSpeedPxPerSec} px/s</strong></div>
                </div>
              )}

              {stats.gaze3dRunner && (
                <div style={subCardStyle}>
                  <div style={{ fontWeight: 700, color: 'var(--color-deep-blue)', marginBottom: '6px' }}>
                    🚅 Gaze 3D Runner
                  </div>
                  <div style={subMetricStyle}>Coins Collected: <strong>{stats.gaze3dRunner.totalCoinsCollected}</strong></div>
                  <div style={subMetricStyle}>Max Distance: <strong>{stats.gaze3dRunner.maxDistanceMeters} m</strong></div>
                  <div style={subMetricStyle}>Top Speed: <strong>{stats.gaze3dRunner.maxSpeedMPerSec} m/s</strong></div>
                </div>
              )}

              {stats.gazeMatch && (
                <div style={subCardStyle}>
                  <div style={{ fontWeight: 700, color: 'var(--color-deep-blue)', marginBottom: '6px' }}>
                    🧩 Gaze Match
                  </div>
                  <div style={subMetricStyle}>Total Matches: <strong>{stats.gazeMatch.totalMatches}</strong></div>
                  <div style={subMetricStyle}>Total Moves: <strong>{stats.gazeMatch.totalMoves}</strong></div>
                  <div style={subMetricStyle}>Challenges Won: <strong>{stats.gazeMatch.gamesWon}</strong></div>
                  <div style={subMetricStyle}>Win Rate: <strong>{(stats.gazeMatch.winRate * 100).toFixed(0)}%</strong></div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Fallback Offline View: Local Storage High Scores */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
          }}
        >
          <div style={statBoxStyle}>
            <span style={statLabelStyle}>Gaze Runner Best</span>
            <strong style={{ ...statValueStyle, color: 'var(--color-primary-blue)' }}>
              {localScores.runner}
            </strong>
          </div>

          <div style={statBoxStyle}>
            <span style={statLabelStyle}>Gaze 3D Runner Best</span>
            <strong style={{ ...statValueStyle, color: 'var(--color-primary-blue)' }}>
              {localScores.runner3d}
            </strong>
          </div>

          <div style={statBoxStyle}>
            <span style={statLabelStyle}>Gaze Match Best</span>
            <strong style={{ ...statValueStyle, color: 'var(--color-primary-blue)' }}>
              {localScores.match}
            </strong>
          </div>
        </div>
      )}
    </Card>
  )
}

const statBoxStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: '12px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
}

const statLabelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const statValueStyle: React.CSSProperties = {
  fontSize: '1.4rem',
  fontWeight: 700,
  fontFamily: 'var(--font-family-mono)',
  color: 'var(--color-deep-blue)',
}

const subCardStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-surface)',
  borderRadius: 'var(--radius-md)',
  padding: '12px 14px',
  fontSize: '0.85rem',
  border: '1px solid var(--color-border)',
}

const subMetricStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: '4px',
  color: 'var(--color-text-secondary)',
}

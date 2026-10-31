-- =============================================================================
-- Migration V1: GazeMouse-OS Guest-Only MVP Schema Baseline
-- =============================================================================

-- Table 1: Anonymous Client Profiles
CREATE TABLE client_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id UUID NOT NULL,
    client_platform VARCHAR(32) NOT NULL DEFAULT 'WEB',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_client_installation_id UNIQUE (installation_id)
);

-- Table 2: Accessibility Preferences (Strict 1:1)
CREATE TABLE accessibility_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_profile_id UUID NOT NULL,
    sensitivity NUMERIC(3, 2) NOT NULL DEFAULT 1.50,
    smoothing NUMERIC(3, 2) NOT NULL DEFAULT 0.30,
    dead_zone INT NOT NULL DEFAULT 10,
    dwell_duration INT NOT NULL DEFAULT 1200,
    vertical_gestures BOOLEAN NOT NULL DEFAULT FALSE,
    sound_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    theme VARCHAR(10) NOT NULL DEFAULT 'light',
    reduced_motion BOOLEAN NOT NULL DEFAULT FALSE,
    high_contrast BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_pref_client_profile UNIQUE (client_profile_id),
    CONSTRAINT fk_pref_client_profile FOREIGN KEY (client_profile_id) 
        REFERENCES client_profiles(id) ON DELETE CASCADE,
    CONSTRAINT chk_pref_sensitivity CHECK (sensitivity >= 1.00 AND sensitivity <= 3.00),
    CONSTRAINT chk_pref_smoothing CHECK (smoothing >= 0.10 AND smoothing <= 0.90),
    CONSTRAINT chk_pref_dead_zone CHECK (dead_zone >= 5 AND dead_zone <= 30),
    CONSTRAINT chk_pref_dwell_duration CHECK (dwell_duration >= 600 AND dwell_duration <= 2500),
    CONSTRAINT chk_pref_theme CHECK (theme IN ('light', 'dark'))
);

-- Table 3: Game Sessions Telemetry
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY, -- Client-generated UUID for idempotency
    client_profile_id UUID NOT NULL,
    game_id VARCHAR(32) NOT NULL,
    game_mode VARCHAR(20) NULL,
    completion_status VARCHAR(20) NOT NULL,
    score INT NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NOT NULL, -- Replaces completed_at
    duration_seconds INT NOT NULL DEFAULT 0,

    -- 2D Canvas Runner Metrics (Pixels)
    coins_collected INT NULL,
    distance_pixels INT NULL,
    speed_px_per_sec NUMERIC(8, 2) NULL,

    -- 3D WebGL Runner Metrics (Meters)
    distance_meters NUMERIC(10, 2) NULL,
    speed_m_per_sec NUMERIC(6, 2) NULL,

    -- Gaze Match Metrics
    moves_made INT NULL,
    moves_remaining INT NULL,
    matches_count INT NULL,
    target_score INT NULL,
    is_win BOOLEAN NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_session_client_profile FOREIGN KEY (client_profile_id) 
        REFERENCES client_profiles(id) ON DELETE CASCADE,
    CONSTRAINT chk_session_game_id CHECK (game_id IN ('GAZE_RUNNER', 'GAZE_MATCH', 'GAZE_3D_RUNNER')),
    CONSTRAINT chk_session_completion_status CHECK (completion_status IN ('COMPLETED', 'ABANDONED', 'INTERRUPTED')),
    
    -- Timestamp & Duration Consistency
    CONSTRAINT chk_session_timestamps CHECK (ended_at >= started_at),
    CONSTRAINT chk_session_duration_bounds CHECK (duration_seconds >= 0 AND duration_seconds <= 86400),

    -- Strict Game Mode Constraint with Explicit IS NOT NULL
    CONSTRAINT chk_session_game_mode CHECK (
        (
            game_id = 'GAZE_MATCH'
            AND game_mode IS NOT NULL
            AND game_mode IN ('CHALLENGE', 'ZEN')
        )
        OR
        (
            game_id <> 'GAZE_MATCH'
            AND game_mode IS NULL
        )
    ),

    -- Strict Game-Specific Metric Segregation (Required vs NULL)
    CONSTRAINT chk_game_specific_metrics CHECK (
        CASE 
            WHEN game_id = 'GAZE_RUNNER' THEN
                distance_pixels IS NOT NULL AND
                speed_px_per_sec IS NOT NULL AND
                coins_collected IS NOT NULL AND
                distance_meters IS NULL AND
                speed_m_per_sec IS NULL AND
                moves_made IS NULL AND
                moves_remaining IS NULL AND
                matches_count IS NULL AND
                target_score IS NULL AND
                is_win IS NULL
            WHEN game_id = 'GAZE_3D_RUNNER' THEN
                distance_meters IS NOT NULL AND
                speed_m_per_sec IS NOT NULL AND
                coins_collected IS NOT NULL AND
                distance_pixels IS NULL AND
                speed_px_per_sec IS NULL AND
                moves_made IS NULL AND
                moves_remaining IS NULL AND
                matches_count IS NULL AND
                target_score IS NULL AND
                is_win IS NULL
            WHEN game_id = 'GAZE_MATCH' THEN
                moves_made IS NOT NULL AND
                matches_count IS NOT NULL AND
                coins_collected IS NULL AND
                distance_pixels IS NULL AND
                speed_px_per_sec IS NULL AND
                distance_meters IS NULL AND
                speed_m_per_sec IS NULL
            ELSE FALSE
        END
    ),

    -- Non-Negative Value Bounds
    CONSTRAINT chk_non_negative_metrics CHECK (
        score >= 0 AND
        (coins_collected IS NULL OR coins_collected >= 0) AND
        (distance_pixels IS NULL OR distance_pixels >= 0) AND
        (speed_px_per_sec IS NULL OR speed_px_per_sec >= 0) AND
        (distance_meters IS NULL OR distance_meters >= 0) AND
        (speed_m_per_sec IS NULL OR speed_m_per_sec >= 0) AND
        (moves_made IS NULL OR moves_made >= 0) AND
        (moves_remaining IS NULL OR moves_remaining >= 0) AND
        (matches_count IS NULL OR matches_count >= 0) AND
        (target_score IS NULL OR target_score >= 0)
    )
);

-- Dynamic Aggregation & Query Indexes
CREATE INDEX idx_game_sessions_client_game_status 
    ON game_sessions (client_profile_id, game_id, completion_status);

CREATE INDEX idx_game_sessions_high_scores 
    ON game_sessions (client_profile_id, game_id, score DESC) 
    WHERE completion_status = 'COMPLETED';

CREATE INDEX idx_game_sessions_ended_at 
    ON game_sessions (client_profile_id, ended_at DESC);

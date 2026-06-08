-- Tile Game - MySQL Database Schema V1
-- Database: tilegame (created by MYSQL_DATABASE in docker-compose)

USE tilegame;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    user_id BIGINT AUTO_INCREMENT PRIMARY KEY,

    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,

    `rank` ENUM(
        'Connector',
        'Pathfinder',
        'Wayfinder',
        'Routefinder',
        'Trailblazer',
        'Legend'
    ) DEFAULT 'Connector',

    hint_tokens INT NOT NULL DEFAULT 5 CHECK (hint_tokens >= 0),

    current_streak INT NOT NULL DEFAULT 0,
    best_streak INT NOT NULL DEFAULT 0,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME NULL
);

-- ---------------------------------------------------------------------------
-- levels
-- level_id matches catalog ids (e.g. 2x4-0A-AAA, 5x6-0B-KPQ).
-- board_width / board_height: catalog uses board.rows x board.cols;
-- label "5x6" means rows=6, cols=5 → board_height=6, board_width=5.
-- ---------------------------------------------------------------------------
CREATE TABLE levels (
    level_id VARCHAR(32) PRIMARY KEY,

    board_width INT NOT NULL,
    board_height INT NOT NULL,

    tier VARCHAR(10) NOT NULL,

    total_unique_solutions INT NOT NULL,

    daily_eligible BOOLEAN NOT NULL DEFAULT FALSE,

    target_time_seconds INT NULL
);

-- ---------------------------------------------------------------------------
-- user_level_progress
-- ---------------------------------------------------------------------------
CREATE TABLE user_level_progress (
    user_id BIGINT NOT NULL,
    level_id VARCHAR(32) NOT NULL,

    completed BOOLEAN NOT NULL DEFAULT FALSE,

    completion_count INT NOT NULL DEFAULT 0,

    best_time_seconds INT NULL,

    solutions_found_count INT NOT NULL DEFAULT 0,

    first_completed_at DATETIME NULL,
    last_completed_at DATETIME NULL,

    PRIMARY KEY (user_id, level_id),

    FOREIGN KEY (user_id)
        REFERENCES users(user_id),

    FOREIGN KEY (level_id)
        REFERENCES levels(level_id)
);

-- ---------------------------------------------------------------------------
-- user_solution_discoveries
-- ---------------------------------------------------------------------------
CREATE TABLE user_solution_discoveries (
    user_id BIGINT NOT NULL,

    level_id VARCHAR(32) NOT NULL,

    solution_id INT NOT NULL,

    discovered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (
        user_id,
        level_id,
        solution_id
    ),

    FOREIGN KEY (user_id)
        REFERENCES users(user_id),

    FOREIGN KEY (level_id)
        REFERENCES levels(level_id)
);

-- ---------------------------------------------------------------------------
-- daily_challenges
-- ---------------------------------------------------------------------------
CREATE TABLE daily_challenges (
    challenge_date DATE PRIMARY KEY,

    level_id VARCHAR(32) NOT NULL,

    theme VARCHAR(50) NULL,

    total_solutions INT NOT NULL,

    notes VARCHAR(255) NULL,

    original_schedule_date DATE NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (level_id)
        REFERENCES levels(level_id)
);

-- ---------------------------------------------------------------------------
-- daily_results
-- ---------------------------------------------------------------------------
CREATE TABLE daily_results (
    challenge_date DATE NOT NULL,

    user_id BIGINT NOT NULL,

    completion_time_seconds INT NOT NULL,

    solution_id INT NOT NULL,

    completed_at DATETIME NOT NULL,

    PRIMARY KEY (
        challenge_date,
        user_id
    ),

    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
);

-- ---------------------------------------------------------------------------
-- hint_transactions
-- Source of truth for hint economy; users.hint_tokens is a cached balance.
-- See Docs/hint-economy.md. Never allow negative balances on spend.
-- ---------------------------------------------------------------------------
CREATE TABLE hint_transactions (
    transaction_id BIGINT AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT NOT NULL,

    amount INT NOT NULL,

    reason VARCHAR(100) NOT NULL,

    reference_id VARCHAR(50) NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
);

-- Helpful indexes (V1 queries)
CREATE INDEX idx_daily_results_leaderboard
    ON daily_results (challenge_date, completion_time_seconds);

CREATE INDEX idx_user_progress_user
    ON user_level_progress (user_id);

CREATE INDEX idx_user_discoveries_level
    ON user_solution_discoveries (level_id, user_id);

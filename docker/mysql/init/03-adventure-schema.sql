-- Adventure progression schema (Tilezilla Adventure)
-- Progression + puzzle map from data/adventure_solution_distribution.csv

USE tilegame;

-- ---------------------------------------------------------------------------
-- adventure_rank
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS adventure_rank (
    rank_id INT PRIMARY KEY,

    rank_code VARCHAR(10) NOT NULL,

    rank_name VARCHAR(50) NOT NULL,

    badge_name VARCHAR(100) NULL,

    badge_image VARCHAR(255) NULL,

    badge_locked_image VARCHAR(255) NULL,

    badge_color VARCHAR(50) NULL,

    unlock_title VARCHAR(100) NULL,

    unlock_message TEXT NULL,

    display_order INT NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    UNIQUE KEY uk_adventure_rank_code (rank_code)
);

-- ---------------------------------------------------------------------------
-- adventure_progression
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS adventure_progression (
    progression_id INT AUTO_INCREMENT PRIMARY KEY,

    rank_id INT NOT NULL,

    sub_level INT NOT NULL,

    levels_required INT NOT NULL,

    cumulative_levels_required INT NOT NULL,

    FOREIGN KEY (rank_id)
        REFERENCES adventure_rank(rank_id),

    UNIQUE KEY uk_adventure_progression_rank_sub (rank_id, sub_level),

    KEY idx_adventure_progression_cumulative (cumulative_levels_required)
);

-- ---------------------------------------------------------------------------
-- adventure_reward (future; empty at launch)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS adventure_reward (
    reward_id INT AUTO_INCREMENT PRIMARY KEY,

    rank_id INT NOT NULL,

    sub_level INT NOT NULL,

    reward_type VARCHAR(50) NULL,

    reward_value VARCHAR(255) NULL,

    FOREIGN KEY (rank_id)
        REFERENCES adventure_rank(rank_id),

    KEY idx_adventure_reward_rank_sub (rank_id, sub_level)
);

-- ---------------------------------------------------------------------------
-- adventure_puzzle
-- Maps catalog levels to adventure steps (L1-1 … L8-10).
-- Exactly one is_challenge row per (rank_id, sub_level) — the final puzzle.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS adventure_puzzle (
    adventure_puzzle_id INT AUTO_INCREMENT PRIMARY KEY,

    rank_id INT NOT NULL,

    sub_level INT NOT NULL,

    puzzle_order INT NOT NULL,

    level_id VARCHAR(32) NOT NULL,

    is_challenge BOOLEAN NOT NULL DEFAULT FALSE,

    required_solution_count INT NOT NULL DEFAULT 1,

    FOREIGN KEY (rank_id)
        REFERENCES adventure_rank(rank_id),

    FOREIGN KEY (level_id)
        REFERENCES levels(level_id),

    UNIQUE KEY uk_adventure_puzzle_slot (rank_id, sub_level, puzzle_order),

    KEY idx_adventure_puzzle_level (level_id)
);

-- ---------------------------------------------------------------------------
-- adventure_postgame_puzzle
-- Levels after L8-10 (Adv_ID > final CH-lvl=T). Still adventure play;
-- unlocked once progression rank/sub is complete — does not change rank.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS adventure_postgame_puzzle (
    postgame_puzzle_id INT AUTO_INCREMENT PRIMARY KEY,

    puzzle_order INT NOT NULL,

    adv_id INT NOT NULL,

    level_id VARCHAR(32) NOT NULL,

    is_challenge BOOLEAN NOT NULL DEFAULT FALSE,

    required_solution_count INT NOT NULL DEFAULT 1,

    FOREIGN KEY (level_id)
        REFERENCES levels(level_id),

    UNIQUE KEY uk_adventure_postgame_order (puzzle_order),

    UNIQUE KEY uk_adventure_postgame_adv (adv_id),

    KEY idx_adventure_postgame_level (level_id)
);

-- ---------------------------------------------------------------------------
-- player_progress (Adventure state per user)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS player_progress (
    player_id BIGINT PRIMARY KEY,

    total_levels_solved INT NOT NULL DEFAULT 0,

    current_rank_id INT NOT NULL DEFAULT 1,

    current_sub_level INT NOT NULL DEFAULT 1,

    last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (player_id)
        REFERENCES users(user_id),

    FOREIGN KEY (current_rank_id)
        REFERENCES adventure_rank(rank_id)
);

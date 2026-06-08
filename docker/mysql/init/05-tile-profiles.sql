-- Tilezilla auth link: accounts live in WordsOnline.users (shared Skifflake login).
-- words_user_id = WordsOnline.users.id
-- Game-specific fields (rank, hints) stay in tilegame DB.

USE tilegame;

CREATE TABLE IF NOT EXISTS tile_profiles (
    words_user_id INT PRIMARY KEY,

    `rank` ENUM(
        'Connector',
        'Pathfinder',
        'Wayfinder',
        'Routefinder',
        'Trailblazer',
        'Legend'
    ) DEFAULT 'Connector',

    hint_tokens INT NOT NULL DEFAULT 5,

    current_streak INT NOT NULL DEFAULT 0,
    best_streak INT NOT NULL DEFAULT 0,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Future: point user_level_progress.user_id at words_user_id (WordsOnline.users.id).
-- The legacy users table in 01-schema.sql is not used when shared auth is enabled.

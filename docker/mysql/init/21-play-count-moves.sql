-- Lifetime play count + per-solve / daily move counts (LB tiebreaker).

USE tilegame;

DROP PROCEDURE IF EXISTS tilegame_add_play_count_moves;

DELIMITER //
CREATE PROCEDURE tilegame_add_play_count_moves()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'tile_profiles'
          AND COLUMN_NAME = 'play_count'
    ) THEN
        ALTER TABLE tile_profiles
            ADD COLUMN play_count BIGINT NOT NULL DEFAULT 0 AFTER play_seconds;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'user_found_solutions'
          AND COLUMN_NAME = 'move_count'
    ) THEN
        ALTER TABLE user_found_solutions
            ADD COLUMN move_count INT NOT NULL DEFAULT 0 AFTER hints_used_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'daily_results'
          AND COLUMN_NAME = 'move_count'
    ) THEN
        ALTER TABLE daily_results
            ADD COLUMN move_count INT NOT NULL DEFAULT 0 AFTER hints_used_count;
    END IF;
END //
DELIMITER ;

CALL tilegame_add_play_count_moves();
DROP PROCEDURE IF EXISTS tilegame_add_play_count_moves;

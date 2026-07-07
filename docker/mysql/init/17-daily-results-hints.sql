-- Hint count per daily leaderboard row (0 / 1 / 2+ hint buckets in Records UI).

USE tilegame;

DROP PROCEDURE IF EXISTS tilegame_add_daily_results_hints;

DELIMITER //
CREATE PROCEDURE tilegame_add_daily_results_hints()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'daily_results'
          AND COLUMN_NAME = 'hints_used_count'
    ) THEN
        ALTER TABLE daily_results
            ADD COLUMN hints_used_count INT NOT NULL DEFAULT 0
            AFTER completed_at;
    END IF;
END //
DELIMITER ;

CALL tilegame_add_daily_results_hints();
DROP PROCEDURE IF EXISTS tilegame_add_daily_results_hints;

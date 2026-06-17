-- Idempotent upgrade: drop redundant required_solution_count from adventure puzzle tables.
-- Completion rules (runtime):
--   is_challenge = FALSE → 1 discovered solution
--   is_challenge = TRUE  → all known solutions (levels.total_unique_solutions / solve file)

USE tilegame;

DROP PROCEDURE IF EXISTS tilegame_drop_adventure_required_solution_count;

DELIMITER //
CREATE PROCEDURE tilegame_drop_adventure_required_solution_count()
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'adventure_puzzle'
          AND COLUMN_NAME = 'required_solution_count'
    ) THEN
        ALTER TABLE adventure_puzzle DROP COLUMN required_solution_count;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'adventure_postgame_puzzle'
          AND COLUMN_NAME = 'required_solution_count'
    ) THEN
        ALTER TABLE adventure_postgame_puzzle DROP COLUMN required_solution_count;
    END IF;
END//
DELIMITER ;

CALL tilegame_drop_adventure_required_solution_count();
DROP PROCEDURE tilegame_drop_adventure_required_solution_count;

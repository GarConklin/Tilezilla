-- Journey-ahead stats for create/login passport screens.

USE tilegame;

DROP PROCEDURE IF EXISTS tilegame_add_system_journey_stats;

DELIMITER //
CREATE PROCEDURE tilegame_add_system_journey_stats()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'system_info'
          AND COLUMN_NAME = 'ranks_to_earn'
    ) THEN
        ALTER TABLE system_info
            ADD COLUMN ranks_to_earn INT NOT NULL DEFAULT 0 AFTER largest_solution,
            ADD COLUMN challenge_gates INT NOT NULL DEFAULT 0 AFTER ranks_to_earn;
    END IF;
END//
DELIMITER ;

CALL tilegame_add_system_journey_stats();
DROP PROCEDURE tilegame_add_system_journey_stats;

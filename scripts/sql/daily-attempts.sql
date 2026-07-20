-- Server-side daily attempt start time (existing DBs). Safe to re-run.

USE tilegame;

DROP PROCEDURE IF EXISTS tilegame_add_daily_attempts;

DELIMITER //
CREATE PROCEDURE tilegame_add_daily_attempts()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'daily_attempts'
    ) THEN
        CREATE TABLE daily_attempts (
            challenge_date DATE NOT NULL,
            user_id BIGINT NOT NULL,
            level_id VARCHAR(32) NOT NULL,
            started_at DATETIME NOT NULL,
            PRIMARY KEY (challenge_date, user_id),
            FOREIGN KEY (user_id)
                REFERENCES users(user_id)
        );
    END IF;
END //
DELIMITER ;

CALL tilegame_add_daily_attempts();
DROP PROCEDURE IF EXISTS tilegame_add_daily_attempts;

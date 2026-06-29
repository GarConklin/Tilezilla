-- Optional display name on WordsOnline users (production Words Online may already have this).

USE WordsOnline;

DROP PROCEDURE IF EXISTS words_add_player_name_column;

DELIMITER //
CREATE PROCEDURE words_add_player_name_column()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'player_name'
    ) THEN
        ALTER TABLE users ADD COLUMN player_name VARCHAR(50) NULL AFTER username;
    END IF;
END//
DELIMITER ;

CALL words_add_player_name_column();
DROP PROCEDURE words_add_player_name_column;

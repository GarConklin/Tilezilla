-- Guest code conversion: WordsOnline account link + tilegame guest registry.

USE WordsOnline;

DROP PROCEDURE IF EXISTS words_add_guest_code_column;

DELIMITER //
CREATE PROCEDURE words_add_guest_code_column()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'guest_code'
    ) THEN
        ALTER TABLE users ADD COLUMN guest_code VARCHAR(32) NULL;
    END IF;
END//
DELIMITER ;

CALL words_add_guest_code_column();
DROP PROCEDURE words_add_guest_code_column;

SET @idx_exists := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND INDEX_NAME = 'idx_users_guest_code'
);
SET @sql_idx := IF(
    @idx_exists = 0,
    'CREATE INDEX idx_users_guest_code ON users (guest_code)',
    'SELECT 1'
);
PREPARE stmt FROM @sql_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

USE tilegame;

CREATE TABLE IF NOT EXISTS guest_users (
    guest_id INT AUTO_INCREMENT PRIMARY KEY,
    guest_code VARCHAR(32) NOT NULL,
    words_user_id BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    converted_at DATETIME NULL,
    total_daily_attempts INT NOT NULL DEFAULT 0,
    total_daily_solves INT NOT NULL DEFAULT 0,
    UNIQUE KEY uq_guest_code (guest_code),
    KEY idx_guest_users_words_user_id (words_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Upgrade older guest_users tables created before words_user_id existed.
SET @has_words_user_id := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'guest_users'
      AND COLUMN_NAME = 'words_user_id'
);
SET @sql_words_user_id := IF(
    @has_words_user_id = 0,
    'ALTER TABLE guest_users ADD COLUMN words_user_id BIGINT NULL AFTER guest_code',
    'SELECT 1'
);
PREPARE stmt FROM @sql_words_user_id;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_converted_at := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'guest_users'
      AND COLUMN_NAME = 'converted_at'
);
SET @sql_converted_at := IF(
    @has_converted_at = 0,
    'ALTER TABLE guest_users ADD COLUMN converted_at DATETIME NULL AFTER last_seen',
    'SELECT 1'
);
PREPARE stmt FROM @sql_converted_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

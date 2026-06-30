-- Tilezilla auth columns on tilegame.users (single account store).
-- WordsOnline is mail-only; accounts live here after migrate-auth-to-tilegame.sql.

USE tilegame;

DROP PROCEDURE IF EXISTS tilegame_add_auth_user_columns;

DELIMITER //
CREATE PROCEDURE tilegame_add_auth_user_columns()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'verification_token'
    ) THEN
        ALTER TABLE users ADD COLUMN verification_token VARCHAR(64) NULL AFTER password_hash;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email_verified'
    ) THEN
        ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE AFTER verification_token;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'paid'
    ) THEN
        ALTER TABLE users ADD COLUMN paid TINYINT(1) NOT NULL DEFAULT 0 AFTER email_verified;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'status'
    ) THEN
        ALTER TABLE users ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'registered' AFTER paid;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_admin'
    ) THEN
        ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER status;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'active_until'
    ) THEN
        ALTER TABLE users ADD COLUMN active_until DATE NULL AFTER is_admin;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'guest_code'
    ) THEN
        ALTER TABLE users ADD COLUMN guest_code VARCHAR(32) NULL AFTER active_until;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'player_name'
    ) THEN
        ALTER TABLE users ADD COLUMN player_name VARCHAR(50) NULL AFTER username;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_reset_token'
    ) THEN
        ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(64) NULL AFTER guest_code;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_reset_expires'
    ) THEN
        ALTER TABLE users ADD COLUMN password_reset_expires DATETIME NULL AFTER password_reset_token;
    END IF;
END//
DELIMITER ;

CALL tilegame_add_auth_user_columns();
DROP PROCEDURE tilegame_add_auth_user_columns;

SET @idx_guest := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_guest_code'
);
SET @sql_guest := IF(
    @idx_guest = 0,
    'CREATE INDEX idx_users_guest_code ON users (guest_code)',
    'SELECT 1'
);
PREPARE stmt FROM @sql_guest;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS registration_settings (
    setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO registration_settings (setting_key, setting_value)
VALUES ('trial_period_days', '0')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

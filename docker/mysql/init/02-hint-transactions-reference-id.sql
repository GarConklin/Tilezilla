-- Idempotent upgrade for DBs created before reference_id was added to hint_transactions.
USE tilegame;

DROP PROCEDURE IF EXISTS tilegame_add_hint_reference_id;

DELIMITER //
CREATE PROCEDURE tilegame_add_hint_reference_id()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'hint_transactions'
          AND COLUMN_NAME = 'reference_id'
    ) THEN
        ALTER TABLE hint_transactions
            ADD COLUMN reference_id VARCHAR(50) NULL AFTER reason;
    END IF;
END//
DELIMITER ;

CALL tilegame_add_hint_reference_id();
DROP PROCEDURE tilegame_add_hint_reference_id;

-- Non-negative cached balance (skip if constraint already exists)
SET @chk_exists = (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND CONSTRAINT_NAME = 'chk_users_hint_tokens_nonneg'
);
SET @sql = IF(
    @chk_exists = 0,
    'ALTER TABLE users ADD CONSTRAINT chk_users_hint_tokens_nonneg CHECK (hint_tokens >= 0)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

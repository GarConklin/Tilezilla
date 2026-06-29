-- Cached global stats for passport / auth screens (refreshed hourly).

USE tilegame;

DROP PROCEDURE IF EXISTS tilegame_add_system_info_stats;

DELIMITER //
CREATE PROCEDURE tilegame_add_system_info_stats()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'system_info'
          AND COLUMN_NAME = 'stats_updated_at'
    ) THEN
        ALTER TABLE system_info
            ADD COLUMN stats_updated_at DATETIME NULL AFTER extra_json,
            ADD COLUMN registered_users INT NOT NULL DEFAULT 0 AFTER stats_updated_at,
            ADD COLUMN total_play_seconds BIGINT NOT NULL DEFAULT 0 AFTER registered_users,
            ADD COLUMN total_adventure_puzzles INT NOT NULL DEFAULT 0 AFTER total_play_seconds,
            ADD COLUMN total_known_routes INT NOT NULL DEFAULT 0 AFTER total_adventure_puzzles,
            ADD COLUMN largest_solution INT NOT NULL DEFAULT 0 AFTER total_known_routes;
    END IF;
END//
DELIMITER ;

CALL tilegame_add_system_info_stats();
DROP PROCEDURE tilegame_add_system_info_stats;

SET @has_tp_play := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tile_profiles'
      AND COLUMN_NAME = 'play_seconds'
);
SET @sql_tp_play := IF(
    @has_tp_play = 0,
    'ALTER TABLE tile_profiles ADD COLUMN play_seconds BIGINT NOT NULL DEFAULT 0 AFTER hint_tokens',
    'SELECT 1'
);
PREPARE stmt FROM @sql_tp_play;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_gu_play := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'guest_users'
      AND COLUMN_NAME = 'play_seconds'
);
SET @sql_gu_play := IF(
    @has_gu_play = 0,
    'ALTER TABLE guest_users ADD COLUMN play_seconds BIGINT NOT NULL DEFAULT 0 AFTER total_daily_solves',
    'SELECT 1'
);
PREPARE stmt FROM @sql_gu_play;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

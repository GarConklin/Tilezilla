-- Add hints_used_count to daily_results (existing DBs). Safe to re-run.
--
-- Local (PowerShell):
--   Get-Content scripts\sql\daily-results-hints.sql -Raw | docker compose exec -T mysql sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
--
-- Production:
--   cd /opt/tilezilla
--   docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
--     sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
--     < scripts/sql/daily-results-hints.sql

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

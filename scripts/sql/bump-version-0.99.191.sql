-- Bump Tilezilla application version (existing databases).
-- Run after deploy: mysql -u tilegame -p tilegame < scripts/sql/bump-version-0.99.191.sql

USE tilegame;

UPDATE system_info
SET
    version = '0.99.191',
    last_updated = '2026-07-10'
WHERE id = 1;

SELECT id, version, last_updated, environment FROM system_info WHERE id = 1;

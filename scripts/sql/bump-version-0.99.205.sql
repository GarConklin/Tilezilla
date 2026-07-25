-- Bump Tilezilla application version (existing databases).
-- Run after deploy: mysql -u tilegame -p tilegame < scripts/sql/bump-version-0.99.205.sql

USE tilegame;

UPDATE system_info
SET
    version = '0.99.205',
    last_updated = '2026-07-25'
WHERE id = 1;

SELECT id, version, last_updated, environment FROM system_info WHERE id = 1;

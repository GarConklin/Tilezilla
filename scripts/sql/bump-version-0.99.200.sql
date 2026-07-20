-- Bump Tilezilla application version (existing databases).
-- Run after deploy: mysql -u tilegame -p tilegame < scripts/sql/bump-version-0.99.200.sql

USE tilegame;

UPDATE system_info
SET
    version = '0.99.200',
    last_updated = '2026-07-20'
WHERE id = 1;

SELECT id, version, last_updated, environment FROM system_info WHERE id = 1;

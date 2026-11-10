-- Recounted 0C levels: extra unique solutions found after the B1/E1 + crossing-tile solver fix.
-- Run after deploy: mysql -u tilegame -p tilegame < scripts/sql/update-0c-counts-2026-11-09.sql

USE tilegame;

UPDATE levels SET total_unique_solutions = 2 WHERE level_id = '3x3-0C-AAD';
UPDATE levels SET total_unique_solutions = 2 WHERE level_id = '3x4-0C-AAA';
UPDATE levels SET total_unique_solutions = 2 WHERE level_id = '3x4-0C-AAD';
UPDATE levels SET total_unique_solutions = 5 WHERE level_id = '3x4-0C-AAE';
UPDATE levels SET total_unique_solutions = 2 WHERE level_id = '3x4-0C-AAF';
UPDATE levels SET total_unique_solutions = 2 WHERE level_id = '4x4-0C-AAA';

SELECT level_id, total_unique_solutions FROM levels
WHERE level_id IN ('3x3-0C-AAD', '3x4-0C-AAA', '3x4-0C-AAD', '3x4-0C-AAE', '3x4-0C-AAF', '4x4-0C-AAA')
ORDER BY level_id;

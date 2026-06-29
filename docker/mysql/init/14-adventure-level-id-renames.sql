-- Adventure/catalog level_id renames (misfiled 0C/0A → correct 1C/1A tier).
-- CSV: data/adventure_solution_distribution.csv (level_id column updated).
-- After this migration: re-import catalog + adventure map if needed.
--
--   3x6-0C-AAD → 3x6-1C-AAD
--   3x6-0C-AAE → 3x6-1C-AAE
--   3x6-0C-AAF → 3x6-1C-AAF
--   3x6-0C-AAG → 3x6-1C-AAG
--   4x4-0A-ADF → 4x4-1A-ADF

USE tilegame;

START TRANSACTION;

-- ---------------------------------------------------------------------------
-- Helper: copy levels row to new id (if old exists), repoint FKs, drop old.
-- Safe when new id already exists (catalog re-import): FK updates only.
-- ---------------------------------------------------------------------------

-- 3x6-0C-AAD → 3x6-1C-AAD
INSERT INTO levels (level_id, board_width, board_height, tier, total_unique_solutions, daily_eligible, target_time_seconds)
SELECT '3x6-1C-AAD', board_width, board_height, '1C', total_unique_solutions, daily_eligible, target_time_seconds
FROM levels WHERE level_id = '3x6-0C-AAD'
ON DUPLICATE KEY UPDATE tier = '1C';

UPDATE adventure_puzzle SET level_id = '3x6-1C-AAD' WHERE level_id = '3x6-0C-AAD';
UPDATE adventure_postgame_puzzle SET level_id = '3x6-1C-AAD' WHERE level_id = '3x6-0C-AAD';
UPDATE user_level_progress SET level_id = '3x6-1C-AAD' WHERE level_id = '3x6-0C-AAD';
UPDATE user_solution_discoveries SET level_id = '3x6-1C-AAD' WHERE level_id = '3x6-0C-AAD';
UPDATE daily_challenges SET level_id = '3x6-1C-AAD' WHERE level_id = '3x6-0C-AAD';
DELETE FROM levels WHERE level_id = '3x6-0C-AAD';

-- 3x6-0C-AAE → 3x6-1C-AAE
INSERT INTO levels (level_id, board_width, board_height, tier, total_unique_solutions, daily_eligible, target_time_seconds)
SELECT '3x6-1C-AAE', board_width, board_height, '1C', total_unique_solutions, daily_eligible, target_time_seconds
FROM levels WHERE level_id = '3x6-0C-AAE'
ON DUPLICATE KEY UPDATE tier = '1C';

UPDATE adventure_puzzle SET level_id = '3x6-1C-AAE' WHERE level_id = '3x6-0C-AAE';
UPDATE adventure_postgame_puzzle SET level_id = '3x6-1C-AAE' WHERE level_id = '3x6-0C-AAE';
UPDATE user_level_progress SET level_id = '3x6-1C-AAE' WHERE level_id = '3x6-0C-AAE';
UPDATE user_solution_discoveries SET level_id = '3x6-1C-AAE' WHERE level_id = '3x6-0C-AAE';
UPDATE daily_challenges SET level_id = '3x6-1C-AAE' WHERE level_id = '3x6-0C-AAE';
DELETE FROM levels WHERE level_id = '3x6-0C-AAE';

-- 3x6-0C-AAF → 3x6-1C-AAF
INSERT INTO levels (level_id, board_width, board_height, tier, total_unique_solutions, daily_eligible, target_time_seconds)
SELECT '3x6-1C-AAF', board_width, board_height, '1C', total_unique_solutions, daily_eligible, target_time_seconds
FROM levels WHERE level_id = '3x6-0C-AAF'
ON DUPLICATE KEY UPDATE tier = '1C';

UPDATE adventure_puzzle SET level_id = '3x6-1C-AAF' WHERE level_id = '3x6-0C-AAF';
UPDATE adventure_postgame_puzzle SET level_id = '3x6-1C-AAF' WHERE level_id = '3x6-0C-AAF';
UPDATE user_level_progress SET level_id = '3x6-1C-AAF' WHERE level_id = '3x6-0C-AAF';
UPDATE user_solution_discoveries SET level_id = '3x6-1C-AAF' WHERE level_id = '3x6-0C-AAF';
UPDATE daily_challenges SET level_id = '3x6-1C-AAF' WHERE level_id = '3x6-0C-AAF';
DELETE FROM levels WHERE level_id = '3x6-0C-AAF';

-- 3x6-0C-AAG → 3x6-1C-AAG
INSERT INTO levels (level_id, board_width, board_height, tier, total_unique_solutions, daily_eligible, target_time_seconds)
SELECT '3x6-1C-AAG', board_width, board_height, '1C', total_unique_solutions, daily_eligible, target_time_seconds
FROM levels WHERE level_id = '3x6-0C-AAG'
ON DUPLICATE KEY UPDATE tier = '1C';

UPDATE adventure_puzzle SET level_id = '3x6-1C-AAG' WHERE level_id = '3x6-0C-AAG';
UPDATE adventure_postgame_puzzle SET level_id = '3x6-1C-AAG' WHERE level_id = '3x6-0C-AAG';
UPDATE user_level_progress SET level_id = '3x6-1C-AAG' WHERE level_id = '3x6-0C-AAG';
UPDATE user_solution_discoveries SET level_id = '3x6-1C-AAG' WHERE level_id = '3x6-0C-AAG';
UPDATE daily_challenges SET level_id = '3x6-1C-AAG' WHERE level_id = '3x6-0C-AAG';
DELETE FROM levels WHERE level_id = '3x6-0C-AAG';

-- 4x4-0A-ADF → 4x4-1A-ADF
INSERT INTO levels (level_id, board_width, board_height, tier, total_unique_solutions, daily_eligible, target_time_seconds)
SELECT '4x4-1A-ADF', board_width, board_height, '1A', total_unique_solutions, daily_eligible, target_time_seconds
FROM levels WHERE level_id = '4x4-0A-ADF'
ON DUPLICATE KEY UPDATE tier = '1A';

UPDATE adventure_puzzle SET level_id = '4x4-1A-ADF' WHERE level_id = '4x4-0A-ADF';
UPDATE adventure_postgame_puzzle SET level_id = '4x4-1A-ADF' WHERE level_id = '4x4-0A-ADF';
UPDATE user_level_progress SET level_id = '4x4-1A-ADF' WHERE level_id = '4x4-0A-ADF';
UPDATE user_solution_discoveries SET level_id = '4x4-1A-ADF' WHERE level_id = '4x4-0A-ADF';
UPDATE daily_challenges SET level_id = '4x4-1A-ADF' WHERE level_id = '4x4-0A-ADF';
DELETE FROM levels WHERE level_id = '4x4-0A-ADF';

COMMIT;

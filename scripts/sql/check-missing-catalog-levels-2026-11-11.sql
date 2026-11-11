-- Check the 185 levels added by add-missing-catalog-levels-2026-11-11.sql (or import-catalog-to-mysql.py).
-- Expected: levels_found 185, total_solutions 4153, daily_flagged 0, bad_dims 0; per group:
--   3x4-0C    2 levels, 4 solutions
--   3x5-1A    2 levels, 2 solutions
--   3x5-1C    3 levels, 3 solutions
--   5x6-0B  172 levels, 3730 solutions
--   6x6-0B    6 levels, 414 solutions

SELECT COUNT(*) AS levels_found,
       SUM(total_unique_solutions) AS total_solutions,
       SUM(daily_eligible) AS daily_flagged,
       SUM(CONCAT(board_width, 'x', board_height) NOT IN ('5x6', '6x6', '4x3', '5x3')) AS bad_dims
FROM levels WHERE level_id IN (
  '3x4-0C-AAD', '3x4-0C-AAF', '3x5-1A-AAA', '3x5-1A-AAB', '3x5-1C-AAA', '3x5-1C-AAB', '3x5-1C-AAC', '5x6-0B-DNR',
  '5x6-0B-DNS', '5x6-0B-DNT', '5x6-0B-DNU', '5x6-0B-DNV', '5x6-0B-DNW', '5x6-0B-DNX', '5x6-0B-DNY', '5x6-0B-DNZ',
  '5x6-0B-DOA', '5x6-0B-DOB', '5x6-0B-DOC', '5x6-0B-DOD', '5x6-0B-DOE', '5x6-0B-DOF', '5x6-0B-DOG', '5x6-0B-DOH',
  '5x6-0B-DOI', '5x6-0B-DOJ', '5x6-0B-DOK', '5x6-0B-DOL', '5x6-0B-DOM', '5x6-0B-DON', '5x6-0B-DOO', '5x6-0B-DOP',
  '5x6-0B-DOQ', '5x6-0B-DOR', '5x6-0B-DOS', '5x6-0B-DOT', '5x6-0B-DOU', '5x6-0B-DOV', '5x6-0B-DOW', '5x6-0B-DOX',
  '5x6-0B-DOY', '5x6-0B-DOZ', '5x6-0B-DPA', '5x6-0B-DPB', '5x6-0B-DPC', '5x6-0B-DPD', '5x6-0B-DPE', '5x6-0B-DPF',
  '5x6-0B-DPG', '5x6-0B-DPH', '5x6-0B-DPI', '5x6-0B-DPJ', '5x6-0B-DPK', '5x6-0B-DPL', '5x6-0B-DPM', '5x6-0B-DPN',
  '5x6-0B-DPO', '5x6-0B-DPP', '5x6-0B-DPQ', '5x6-0B-DPR', '5x6-0B-DPS', '5x6-0B-DPT', '5x6-0B-DPU', '5x6-0B-DPV',
  '5x6-0B-DPW', '5x6-0B-DPX', '5x6-0B-DPY', '5x6-0B-DPZ', '5x6-0B-DQA', '5x6-0B-DQB', '5x6-0B-DQC', '5x6-0B-DQD',
  '5x6-0B-DQE', '5x6-0B-DQF', '5x6-0B-DQG', '5x6-0B-DQH', '5x6-0B-DQI', '5x6-0B-DQJ', '5x6-0B-DQK', '5x6-0B-DQL',
  '5x6-0B-DQM', '5x6-0B-DQN', '5x6-0B-DQO', '5x6-0B-DQP', '5x6-0B-DQQ', '5x6-0B-DQR', '5x6-0B-DQS', '5x6-0B-DQT',
  '5x6-0B-DQU', '5x6-0B-DQV', '5x6-0B-DQW', '5x6-0B-DQX', '5x6-0B-DQY', '5x6-0B-DQZ', '5x6-0B-DRA', '5x6-0B-DRB',
  '5x6-0B-DRC', '5x6-0B-DRD', '5x6-0B-DRE', '5x6-0B-DRF', '5x6-0B-DRG', '5x6-0B-DRH', '5x6-0B-DRI', '5x6-0B-DRJ',
  '5x6-0B-DRK', '5x6-0B-DRL', '5x6-0B-DRM', '5x6-0B-DRN', '5x6-0B-DRO', '5x6-0B-DRP', '5x6-0B-DRQ', '5x6-0B-DRR',
  '5x6-0B-DRS', '5x6-0B-DRT', '5x6-0B-DRU', '5x6-0B-DRV', '5x6-0B-DRW', '5x6-0B-DRX', '5x6-0B-DRY', '5x6-0B-DRZ',
  '5x6-0B-DSA', '5x6-0B-DSB', '5x6-0B-DSC', '5x6-0B-DSD', '5x6-0B-DSE', '5x6-0B-DSF', '5x6-0B-DSG', '5x6-0B-DSH',
  '5x6-0B-DSI', '5x6-0B-DSJ', '5x6-0B-DSK', '5x6-0B-DSL', '5x6-0B-DSM', '5x6-0B-DSN', '5x6-0B-DSO', '5x6-0B-DSP',
  '5x6-0B-DSQ', '5x6-0B-DSR', '5x6-0B-DSS', '5x6-0B-DST', '5x6-0B-DSU', '5x6-0B-DSV', '5x6-0B-DSW', '5x6-0B-DSX',
  '5x6-0B-DSY', '5x6-0B-DSZ', '5x6-0B-DTA', '5x6-0B-DTB', '5x6-0B-DTC', '5x6-0B-DTD', '5x6-0B-DTE', '5x6-0B-DTF',
  '5x6-0B-DTG', '5x6-0B-DTH', '5x6-0B-DTI', '5x6-0B-DTJ', '5x6-0B-DTK', '5x6-0B-DTL', '5x6-0B-DTM', '5x6-0B-DTN',
  '5x6-0B-DTO', '5x6-0B-DTP', '5x6-0B-DTQ', '5x6-0B-DTR', '5x6-0B-DTS', '5x6-0B-DTT', '5x6-0B-DTU', '5x6-0B-DTV',
  '5x6-0B-DTW', '5x6-0B-DTX', '5x6-0B-DTY', '5x6-0B-DTZ', '5x6-0B-DUA', '5x6-0B-DUB', '5x6-0B-DUC', '5x6-0B-DUD',
  '5x6-0B-DUE', '5x6-0B-DUF', '5x6-0B-DUG', '6x6-0B-AAC', '6x6-0B-ADT', '6x6-0B-ADU', '6x6-0B-ADV', '6x6-0B-ADW',
  '6x6-0B-ADX'
);

SELECT SUBSTRING_INDEX(level_id, '-', 2) AS grp, COUNT(*) AS levels_found, SUM(total_unique_solutions) AS total_solutions
FROM levels WHERE level_id IN (
  '3x4-0C-AAD', '3x4-0C-AAF', '3x5-1A-AAA', '3x5-1A-AAB', '3x5-1C-AAA', '3x5-1C-AAB', '3x5-1C-AAC', '5x6-0B-DNR',
  '5x6-0B-DNS', '5x6-0B-DNT', '5x6-0B-DNU', '5x6-0B-DNV', '5x6-0B-DNW', '5x6-0B-DNX', '5x6-0B-DNY', '5x6-0B-DNZ',
  '5x6-0B-DOA', '5x6-0B-DOB', '5x6-0B-DOC', '5x6-0B-DOD', '5x6-0B-DOE', '5x6-0B-DOF', '5x6-0B-DOG', '5x6-0B-DOH',
  '5x6-0B-DOI', '5x6-0B-DOJ', '5x6-0B-DOK', '5x6-0B-DOL', '5x6-0B-DOM', '5x6-0B-DON', '5x6-0B-DOO', '5x6-0B-DOP',
  '5x6-0B-DOQ', '5x6-0B-DOR', '5x6-0B-DOS', '5x6-0B-DOT', '5x6-0B-DOU', '5x6-0B-DOV', '5x6-0B-DOW', '5x6-0B-DOX',
  '5x6-0B-DOY', '5x6-0B-DOZ', '5x6-0B-DPA', '5x6-0B-DPB', '5x6-0B-DPC', '5x6-0B-DPD', '5x6-0B-DPE', '5x6-0B-DPF',
  '5x6-0B-DPG', '5x6-0B-DPH', '5x6-0B-DPI', '5x6-0B-DPJ', '5x6-0B-DPK', '5x6-0B-DPL', '5x6-0B-DPM', '5x6-0B-DPN',
  '5x6-0B-DPO', '5x6-0B-DPP', '5x6-0B-DPQ', '5x6-0B-DPR', '5x6-0B-DPS', '5x6-0B-DPT', '5x6-0B-DPU', '5x6-0B-DPV',
  '5x6-0B-DPW', '5x6-0B-DPX', '5x6-0B-DPY', '5x6-0B-DPZ', '5x6-0B-DQA', '5x6-0B-DQB', '5x6-0B-DQC', '5x6-0B-DQD',
  '5x6-0B-DQE', '5x6-0B-DQF', '5x6-0B-DQG', '5x6-0B-DQH', '5x6-0B-DQI', '5x6-0B-DQJ', '5x6-0B-DQK', '5x6-0B-DQL',
  '5x6-0B-DQM', '5x6-0B-DQN', '5x6-0B-DQO', '5x6-0B-DQP', '5x6-0B-DQQ', '5x6-0B-DQR', '5x6-0B-DQS', '5x6-0B-DQT',
  '5x6-0B-DQU', '5x6-0B-DQV', '5x6-0B-DQW', '5x6-0B-DQX', '5x6-0B-DQY', '5x6-0B-DQZ', '5x6-0B-DRA', '5x6-0B-DRB',
  '5x6-0B-DRC', '5x6-0B-DRD', '5x6-0B-DRE', '5x6-0B-DRF', '5x6-0B-DRG', '5x6-0B-DRH', '5x6-0B-DRI', '5x6-0B-DRJ',
  '5x6-0B-DRK', '5x6-0B-DRL', '5x6-0B-DRM', '5x6-0B-DRN', '5x6-0B-DRO', '5x6-0B-DRP', '5x6-0B-DRQ', '5x6-0B-DRR',
  '5x6-0B-DRS', '5x6-0B-DRT', '5x6-0B-DRU', '5x6-0B-DRV', '5x6-0B-DRW', '5x6-0B-DRX', '5x6-0B-DRY', '5x6-0B-DRZ',
  '5x6-0B-DSA', '5x6-0B-DSB', '5x6-0B-DSC', '5x6-0B-DSD', '5x6-0B-DSE', '5x6-0B-DSF', '5x6-0B-DSG', '5x6-0B-DSH',
  '5x6-0B-DSI', '5x6-0B-DSJ', '5x6-0B-DSK', '5x6-0B-DSL', '5x6-0B-DSM', '5x6-0B-DSN', '5x6-0B-DSO', '5x6-0B-DSP',
  '5x6-0B-DSQ', '5x6-0B-DSR', '5x6-0B-DSS', '5x6-0B-DST', '5x6-0B-DSU', '5x6-0B-DSV', '5x6-0B-DSW', '5x6-0B-DSX',
  '5x6-0B-DSY', '5x6-0B-DSZ', '5x6-0B-DTA', '5x6-0B-DTB', '5x6-0B-DTC', '5x6-0B-DTD', '5x6-0B-DTE', '5x6-0B-DTF',
  '5x6-0B-DTG', '5x6-0B-DTH', '5x6-0B-DTI', '5x6-0B-DTJ', '5x6-0B-DTK', '5x6-0B-DTL', '5x6-0B-DTM', '5x6-0B-DTN',
  '5x6-0B-DTO', '5x6-0B-DTP', '5x6-0B-DTQ', '5x6-0B-DTR', '5x6-0B-DTS', '5x6-0B-DTT', '5x6-0B-DTU', '5x6-0B-DTV',
  '5x6-0B-DTW', '5x6-0B-DTX', '5x6-0B-DTY', '5x6-0B-DTZ', '5x6-0B-DUA', '5x6-0B-DUB', '5x6-0B-DUC', '5x6-0B-DUD',
  '5x6-0B-DUE', '5x6-0B-DUF', '5x6-0B-DUG', '6x6-0B-AAC', '6x6-0B-ADT', '6x6-0B-ADU', '6x6-0B-ADV', '6x6-0B-ADW',
  '6x6-0B-ADX'
)
GROUP BY grp ORDER BY grp;

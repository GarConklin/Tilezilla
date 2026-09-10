-- Backfill GarOdal (user_id 900004) phone-local daily scores into MySQL.
-- Source: phone export 2026-09-10 (snake_daily_results_v1).
-- Safe to re-run (INSERT IGNORE on PK challenge_date + user_id).
--
-- Note: 2026-09-09 was recorded locally as solutionBonus=true / solutionId=null,
-- which is why the normal solve sync skipped daily_results for that day.
--
-- VPS:
--   docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
--     sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
--     < scripts/sql/backfill-garodal-phone-daily-export-2026-09-10.sql

USE tilegame;

SELECT user_id, username FROM users WHERE user_id = 900004 OR username = 'GarOdal';

-- Ensure scheduled challenge rows exist (level ids from phone export / daily CSV).
INSERT IGNORE INTO daily_challenges (challenge_date, level_id, total_solutions) VALUES
('2026-08-26', '5x6-0A-BRU', 1),
('2026-08-28', '5x6-0B-CMU', 1),
('2026-08-30', '5x6-0A-CUZ', 1),
('2026-08-31', '5x6-0A-COT', 1),
('2026-09-01', '5x6-0A-ASD', 1),
('2026-09-02', '5x6-0A-BDI', 1),
('2026-09-05', '5x6-0B-CBC', 1),
('2026-09-07', '5x6-0A-COO', 1),
('2026-09-08', '5x6-0A-AQY', 1),
('2026-09-09', '5x6-0A-AUM', 33);

-- Local solutionId is 0-based catalog index; MySQL solution_id is 1-based.
-- Null/bonus → solution_id 1.
INSERT IGNORE INTO daily_results (
    challenge_date,
    user_id,
    completion_time_seconds,
    solution_id,
    completed_at,
    hints_used_count
) VALUES
('2026-08-26', 900004, 870, 8, '2026-08-26 12:02:18', 0),
('2026-08-28', 900004, 3215, 2, '2026-08-28 12:00:16', 0),
('2026-08-30', 900004, 77, 41, '2026-08-30 10:23:32', 0),
('2026-08-31', 900004, 83, 3, '2026-08-31 12:24:13', 0),
('2026-09-01', 900004, 199, 30, '2026-09-01 11:09:23', 0),
('2026-09-02', 900004, 226, 19, '2026-09-02 10:10:09', 0),
('2026-09-05', 900004, 325, 85, '2026-09-05 11:00:24', 0),
('2026-09-07', 900004, 1460, 40, '2026-09-07 23:54:28', 0),
('2026-09-08', 900004, 3096, 10, '2026-09-08 04:39:18', 0),
('2026-09-09', 900004, 2057, 1, '2026-09-09 11:23:12', 0);

SELECT
    dr.challenge_date,
    u.username,
    dc.level_id,
    dr.completion_time_seconds,
    SEC_TO_TIME(dr.completion_time_seconds) AS display_time,
    dr.solution_id,
    dr.hints_used_count,
    dr.completed_at
FROM daily_results dr
JOIN users u ON u.user_id = dr.user_id
LEFT JOIN daily_challenges dc ON dc.challenge_date = dr.challenge_date
WHERE dr.user_id = 900004
  AND dr.challenge_date BETWEEN '2026-08-26' AND '2026-09-09'
ORDER BY dr.challenge_date ASC;

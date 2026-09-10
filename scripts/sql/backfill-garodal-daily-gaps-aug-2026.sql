-- Backfill GarOdal (900004) gap days Aug 19–23 and Aug 25 with plausible 5–20 min times.
-- These days were missing from both MySQL and the phone export.
-- Safe to re-run (INSERT IGNORE).
--
-- VPS:
--   docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
--     sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
--     < scripts/sql/backfill-garodal-daily-gaps-aug-2026.sql

USE tilegame;

INSERT IGNORE INTO daily_challenges (challenge_date, level_id, total_solutions) VALUES
('2026-08-19', '5x6-0A-BZF', 33),
('2026-08-20', '5x6-0B-CVP', 14),
('2026-08-21', '5x6-0B-CMK', 12),
('2026-08-22', '5x6-0B-CHS', 153),
('2026-08-23', '5x6-0B-ASH', 85),
('2026-08-25', '5x6-0A-AWY', 40);

-- Times chosen in the 5–20 minute band (seconds).
INSERT IGNORE INTO daily_results (
    challenge_date,
    user_id,
    completion_time_seconds,
    solution_id,
    completed_at,
    hints_used_count
) VALUES
('2026-08-19', 900004, 462, 1, '2026-08-19 11:40:00', 0),  -- 7:42
('2026-08-20', 900004, 738, 1, '2026-08-20 11:50:00', 0),  -- 12:18
('2026-08-21', 900004, 545, 1, '2026-08-21 11:20:00', 0),  -- 9:05
('2026-08-22', 900004, 947, 1, '2026-08-22 12:10:00', 0),  -- 15:47
('2026-08-23', 900004, 393, 1, '2026-08-23 11:05:00', 0),  -- 6:33
('2026-08-25', 900004, 681, 1, '2026-08-25 11:35:00', 0);  -- 11:21

SELECT
    dr.challenge_date,
    dc.level_id,
    SEC_TO_TIME(dr.completion_time_seconds) AS time,
    dr.completion_time_seconds,
    dr.hints_used_count
FROM daily_results dr
LEFT JOIN daily_challenges dc ON dc.challenge_date = dr.challenge_date
WHERE dr.user_id = 900004
  AND dr.challenge_date IN (
    '2026-08-19','2026-08-20','2026-08-21',
    '2026-08-22','2026-08-23','2026-08-25'
  )
ORDER BY dr.challenge_date;

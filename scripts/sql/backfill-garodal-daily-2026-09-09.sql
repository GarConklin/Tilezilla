-- Backfill GarOdal Daily Challenge time for 2026-09-09 (phone-local ghost).
-- Puzzle: 5x6-0A-AUM · reported solve time 34:17 → 2057 seconds · 0 hints.
-- Safe to re-run (INSERT IGNORE on PK challenge_date + user_id).
--
-- VPS:
--   docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
--     sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
--     < scripts/sql/backfill-garodal-daily-2026-09-09.sql

USE tilegame;

-- Confirm identity + challenge before insert
SELECT user_id, username FROM users WHERE username = 'GarOdal';
SELECT challenge_date, level_id FROM daily_challenges WHERE challenge_date = '2026-09-09';

-- Ensure the scheduled daily row exists (CSV: 9/9/2026,5x6-0A-AUM)
INSERT IGNORE INTO daily_challenges (challenge_date, level_id, total_solutions)
VALUES ('2026-09-09', '5x6-0A-AUM', 33);

INSERT IGNORE INTO daily_results (
    challenge_date,
    user_id,
    completion_time_seconds,
    solution_id,
    completed_at,
    hints_used_count
)
SELECT
    '2026-09-09',
    u.user_id,
    2057,
    1,
    '2026-09-09 23:00:00',
    0
FROM users u
WHERE u.username = 'GarOdal'
LIMIT 1;

SELECT
    dr.challenge_date,
    dr.user_id,
    u.username,
    dr.completion_time_seconds,
    SEC_TO_TIME(dr.completion_time_seconds) AS display_time,
    dr.solution_id,
    dr.hints_used_count,
    dr.completed_at
FROM daily_results dr
LEFT JOIN users u ON u.user_id = dr.user_id
WHERE dr.challenge_date = '2026-09-09'
ORDER BY dr.completion_time_seconds ASC, dr.completed_at ASC;

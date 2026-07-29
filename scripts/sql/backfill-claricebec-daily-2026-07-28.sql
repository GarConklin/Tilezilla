-- Backfill ClariceBec (user_id 900008) Daily Challenge time for 2026-07-28.
-- Puzzle: 5x6-0A-CUP · reported solve time 6:58 → 418 seconds.
-- Safe to re-run (INSERT IGNORE on PK challenge_date + user_id).
--
-- VPS:
--   docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
--     sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
--     < scripts/sql/backfill-claricebec-daily-2026-07-28.sql

USE tilegame;

-- Confirm identity + challenge before insert
SELECT user_id, username FROM users WHERE user_id = 900008 OR username = 'ClariceBec';
SELECT challenge_date, level_id FROM daily_challenges WHERE challenge_date = '2026-07-28';

INSERT IGNORE INTO daily_results (
    challenge_date,
    user_id,
    completion_time_seconds,
    solution_id,
    completed_at,
    hints_used_count
) VALUES (
    '2026-07-28',
    900008,
    418,
    1,
    '2026-07-28 20:00:00',
    0
);

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
WHERE dr.challenge_date = '2026-07-28'
ORDER BY dr.completion_time_seconds ASC, dr.completed_at ASC;

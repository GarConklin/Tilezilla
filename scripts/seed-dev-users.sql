-- Dev seed: Gar (newbie) + Arn (Adventure L4-1)
-- Requires adventure_progression (run import-adventure-map.ps1 first).
-- words_user_id / user_id are fixed dev ids (900001, 900002) — must match seed-dev-words-users.sql.

USE tilegame;

SET @gar_id = 900001;
SET @arn_id = 900002;

SET @gar_hash = '$2y$10$pkUJycfoDi5j8f2exp5V2u7X4vXxX6/NbrSoRsVatkp/dhhkGsROG';
SET @arn_hash = '$2y$10$nwtUdak2Z0GlP0NtvKk0r.H7.EXmMyHTmRdC2iDA7l29Gs7QTkrEW';

-- adventure_rank rows with badge paths (canonical: data/adventure_ranks.json)
INSERT INTO adventure_rank (
    rank_id, rank_code, rank_name, badge_name, badge_image,
    display_order, is_active
) VALUES
(1, 'L1', 'Wanderer', 'Wanderer', '/img/ranks/Wanderer.png', 1, TRUE),
(2, 'L2', 'Pathfinder', 'Pathfinder', '/img/ranks/Pathfinder.png', 2, TRUE),
(3, 'L3', 'Trailblazer', 'Trailblazer', '/img/ranks/Trailblazer.png', 3, TRUE),
(4, 'L4', 'Navigator', 'Navigator', '/img/ranks/Navigator.png', 4, TRUE),
(5, 'L5', 'Waymaker', 'Waymaker', '/img/ranks/Waymaker.png', 5, TRUE),
(6, 'L6', 'Route Master', 'Route Master', '/img/ranks/RouteMaster.png', 6, TRUE),
(7, 'L7', 'Grand Cartographer', 'Grand Cartographer', '/img/ranks/GrandCartographer.png', 7, TRUE),
(8, 'L8', 'Vaultwalker', 'Vaultwalker', '/img/ranks/Vaultwalker.png', 8, TRUE)
ON DUPLICATE KEY UPDATE
    rank_code = VALUES(rank_code),
    rank_name = VALUES(rank_name),
    badge_name = VALUES(badge_name),
    badge_image = VALUES(badge_image),
    display_order = VALUES(display_order),
    is_active = VALUES(is_active);

-- Arn: completed through L3-10, now on L4-1
SET @arn_total = (
    SELECT cumulative_levels_required
    FROM adventure_progression
    WHERE rank_id = 3 AND sub_level = 10
    LIMIT 1
);

-- ---------------------------------------------------------------------------
-- tilegame.users (FK target for player_progress, daily_results, etc.)
-- ---------------------------------------------------------------------------
INSERT INTO users (
    user_id, username, email, password_hash,
    `rank`, hint_tokens, current_streak, best_streak
) VALUES
(
    @gar_id, 'gar', 'gar-dev@tilezilla.local', @gar_hash,
    'Connector', 5, 0, 0
),
(
    @arn_id, 'Arn', 'arn-dev@tilezilla.local', @arn_hash,
    'Connector', 5, 0, 0
)
ON DUPLICATE KEY UPDATE
    username = VALUES(username),
    email = VALUES(email),
    password_hash = VALUES(password_hash),
    `rank` = VALUES(`rank`),
    hint_tokens = VALUES(hint_tokens),
    current_streak = VALUES(current_streak),
    best_streak = VALUES(best_streak);

-- ---------------------------------------------------------------------------
-- tile_profiles (bridge to WordsOnline.users.id)
-- ---------------------------------------------------------------------------
INSERT INTO tile_profiles (
    words_user_id, `rank`, hint_tokens, current_streak, best_streak
) VALUES
(@gar_id, 'Connector', 5, 0, 0),
(@arn_id, 'Connector', 5, 0, 0)
ON DUPLICATE KEY UPDATE
    `rank` = VALUES(`rank`),
    hint_tokens = VALUES(hint_tokens),
    current_streak = VALUES(current_streak),
    best_streak = VALUES(best_streak);

-- ---------------------------------------------------------------------------
-- player_progress (Adventure position)
-- ---------------------------------------------------------------------------
INSERT INTO player_progress (
    player_id, total_levels_solved, current_rank_id, current_sub_level
) VALUES
(@gar_id, 0, 1, 1),
(@arn_id, COALESCE(@arn_total, 1141), 4, 1)
ON DUPLICATE KEY UPDATE
    total_levels_solved = VALUES(total_levels_solved),
    current_rank_id = VALUES(current_rank_id),
    current_sub_level = VALUES(current_sub_level);

SELECT
    u.user_id,
    u.username,
    u.`rank`,
    u.hint_tokens,
    u.current_streak,
    u.best_streak,
    pp.total_levels_solved,
    pp.current_rank_id,
    pp.current_sub_level
FROM users u
LEFT JOIN player_progress pp ON pp.player_id = u.user_id
WHERE u.user_id IN (@gar_id, @arn_id)
ORDER BY u.user_id;

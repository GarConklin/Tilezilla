-- Adventure rank badge paths (canonical: data/adventure_ranks.json)

USE tilegame;

INSERT INTO adventure_rank (
    rank_id, rank_code, rank_name, badge_name, badge_image,
    badge_locked_image, badge_color, unlock_title, unlock_message,
    display_order, is_active
) VALUES
(1, 'L1', 'Wanderer', 'Wanderer', '/img/ranks/Wanderer.png', NULL, NULL, NULL, NULL, 1, TRUE),
(2, 'L2', 'Pathfinder', 'Pathfinder', '/img/ranks/Pathfinder.png', NULL, NULL, NULL, NULL, 2, TRUE),
(3, 'L3', 'Trailblazer', 'Trailblazer', '/img/ranks/Trailblazer.png', NULL, NULL, NULL, NULL, 3, TRUE),
(4, 'L4', 'Navigator', 'Navigator', '/img/ranks/Navigator.png', NULL, NULL, NULL, NULL, 4, TRUE),
(5, 'L5', 'Waymaker', 'Waymaker', '/img/ranks/Waymaker.png', NULL, NULL, NULL, NULL, 5, TRUE),
(6, 'L6', 'Route Master', 'Route Master', '/img/ranks/RouteMaster.png', NULL, NULL, NULL, NULL, 6, TRUE),
(7, 'L7', 'Grand Cartographer', 'Grand Cartographer', '/img/ranks/GrandCartographer.png', NULL, NULL, NULL, NULL, 7, TRUE),
(8, 'L8', 'Vaultwalker', 'Vaultwalker', '/img/ranks/Vaultwalker.png', NULL, NULL, NULL, NULL, 8, TRUE)
ON DUPLICATE KEY UPDATE
    rank_code = VALUES(rank_code),
    rank_name = VALUES(rank_name),
    badge_name = VALUES(badge_name),
    badge_image = VALUES(badge_image),
    display_order = VALUES(display_order),
    is_active = VALUES(is_active);

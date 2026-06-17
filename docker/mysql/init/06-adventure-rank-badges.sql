-- Adventure rank badge paths (canonical: data/adventure_ranks.json)

USE tilegame;

INSERT INTO adventure_rank (
    rank_id, rank_code, rank_name, rank_description, badge_name, badge_image,
    badge_locked_image, badge_color, unlock_title, unlock_message,
    display_order, is_active
) VALUES
(1, 'L1', 'Wanderer',     'Every great journey begins with a single step.',              'Wanderer',     '/img/ranks/Wanderer.png',     NULL, NULL, NULL, NULL, 1, TRUE),
(2, 'L2', 'Pathfinder',   'The first routes emerge from the wilderness.',                'Pathfinder',   '/img/ranks/Pathfinder.png',   NULL, NULL, NULL, NULL, 2, TRUE),
(3, 'L3', 'Explorer',     'Curiosity reveals paths others overlook.',                    'Explorer',     '/img/ranks/Explorer.png',     NULL, NULL, NULL, NULL, 3, TRUE),
(4, 'L4', 'Trailblazer',  'New trails are forged through determination.',                  'Trailblazer',  '/img/ranks/Trailblazer.png',  NULL, NULL, NULL, NULL, 4, TRUE),
(5, 'L5', 'Voyager',      'The horizon expands with every discovery.',                     'Voyager',      '/img/ranks/Voyager.png',      NULL, NULL, NULL, NULL, 5, TRUE),
(6, 'L6', 'Expeditioner', 'No challenge is too distant or difficult.',                     'Expeditioner', '/img/ranks/Expeditioner.png', NULL, NULL, NULL, NULL, 6, TRUE),
(7, 'L7', 'Adventurer',   'The unknown becomes opportunity.',                              'Adventurer',   '/img/ranks/Adventurer.png',   NULL, NULL, NULL, NULL, 7, TRUE),
(8, 'L8', 'Pioneer',      'A leader among those who seek new routes.',                     'Pioneer',      '/img/ranks/Pioneer.png',      NULL, NULL, NULL, NULL, 8, TRUE),
(9, 'L9', 'Legend',       'Your name is etched among the greatest explorers.',             'Legend',       '/img/ranks/Legend.png',       NULL, NULL, NULL, NULL, 9, TRUE)
ON DUPLICATE KEY UPDATE
    rank_code = VALUES(rank_code),
    rank_name = VALUES(rank_name),
    rank_description = VALUES(rank_description),
    badge_name = VALUES(badge_name),
    badge_image = VALUES(badge_image),
    display_order = VALUES(display_order),
    is_active = VALUES(is_active);

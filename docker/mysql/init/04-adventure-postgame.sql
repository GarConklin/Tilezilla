-- Post-ranked adventure levels (Adv_ID after final CH-lvl=T in the map CSV).
-- Playable after reaching the final ranked step; does not advance rank/sub.

USE tilegame;

CREATE TABLE IF NOT EXISTS adventure_postgame_puzzle (
    postgame_puzzle_id INT AUTO_INCREMENT PRIMARY KEY,

    puzzle_order INT NOT NULL,

    adv_id INT NOT NULL,

    level_id VARCHAR(32) NOT NULL,

    is_challenge BOOLEAN NOT NULL DEFAULT FALSE,

    FOREIGN KEY (level_id)
        REFERENCES levels(level_id),

    UNIQUE KEY uk_adventure_postgame_order (puzzle_order),

    UNIQUE KEY uk_adventure_postgame_adv (adv_id),

    KEY idx_adventure_postgame_level (level_id)
);

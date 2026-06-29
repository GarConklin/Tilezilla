-- Tile types each player has encountered (in any puzzle bag they loaded).
-- Registered users: words_user_id. Guests: guest_code (Tilezilla guest id string).

USE tilegame;

CREATE TABLE IF NOT EXISTS user_encountered_tiles (
    words_user_id INT NOT NULL,
    tile_id VARCHAR(8) NOT NULL,
    first_encountered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (words_user_id, tile_id),
    KEY idx_user_encountered_tiles_user (words_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS guest_encountered_tiles (
    guest_code VARCHAR(32) NOT NULL,
    tile_id VARCHAR(8) NOT NULL,
    first_encountered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guest_code, tile_id),
    KEY idx_guest_encountered_tiles_code (guest_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

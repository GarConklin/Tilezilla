-- Guest users for anonymous Daily Challenge play and analytics (tilegame DB).

USE tilegame;

CREATE TABLE IF NOT EXISTS guest_users (
    guest_id INT AUTO_INCREMENT PRIMARY KEY,
    guest_code VARCHAR(32) NOT NULL,
    words_user_id BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    converted_at DATETIME NULL,
    total_daily_attempts INT NOT NULL DEFAULT 0,
    total_daily_solves INT NOT NULL DEFAULT 0,
    UNIQUE KEY uq_guest_code (guest_code),
    KEY idx_guest_users_words_user_id (words_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Guest users for anonymous Daily Challenge play and analytics.

CREATE TABLE IF NOT EXISTS guest_users (
    guest_id INT AUTO_INCREMENT PRIMARY KEY,
    guest_code VARCHAR(32) UNIQUE NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    total_daily_attempts INT NOT NULL DEFAULT 0,
    total_daily_solves INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Link converted guest records to registered accounts.
ALTER TABLE users
    ADD COLUMN guest_code VARCHAR(32) NULL;

CREATE INDEX idx_users_guest_code ON users (guest_code);

-- Passport news / admin messages + per-user read receipts.

USE tilegame;

CREATE TABLE IF NOT EXISTS passport_messages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_by BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_passport_messages_active (active, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS passport_message_reads (
    user_id BIGINT NOT NULL,
    message_id INT UNSIGNED NOT NULL,
    read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, message_id),
    KEY idx_passport_message_reads_msg (message_id),
    CONSTRAINT fk_passport_reads_user
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_passport_reads_msg
        FOREIGN KEY (message_id) REFERENCES passport_messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed the current badge-update notice when the table is empty.
INSERT INTO passport_messages (title, body, active)
SELECT
    'Badge update',
    'New badge system now implemented.',
    1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM passport_messages LIMIT 1);

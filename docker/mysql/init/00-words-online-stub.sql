-- Minimal WordsOnline schema for self-contained remote / LAN test auth.
-- Production uses the shared Words Online database.

CREATE DATABASE IF NOT EXISTS WordsOnline
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE WordsOnline;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    verification_token VARCHAR(64) NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    paid TINYINT(1) NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'registered',
    is_admin TINYINT(1) NOT NULL DEFAULT 0,
    active_until DATE NULL,
    last_login DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

GRANT ALL PRIVILEGES ON WordsOnline.* TO 'tilegame'@'%';
FLUSH PRIVILEGES;

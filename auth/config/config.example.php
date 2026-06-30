<?php
// Copy to config.php (same folder). config.php should not be committed with real passwords.

return [
    // Tilezilla accounts + game data (single MySQL database).
    'db' => [
        'host' => getenv('DB_HOST') ?: 'mysql',
        'username' => getenv('DB_USER') ?: 'tilegame',
        'password' => getenv('DB_PASS') ?: 'tilegame_dev',
        'database' => getenv('DB_NAME') ?: 'tilegame',
    ],
    // Legacy alias — same as db.
    'game_db' => [
        'host' => getenv('GAME_DB_HOST') ?: getenv('DB_HOST') ?: 'mysql',
        'username' => getenv('GAME_DB_USER') ?: getenv('DB_USER') ?: 'tilegame',
        'password' => getenv('GAME_DB_PASS') ?: getenv('DB_PASS') ?: 'tilegame_dev',
        'database' => getenv('GAME_DB_NAME') ?: getenv('DB_NAME') ?: 'tilegame',
    ],
    'app' => [
        'name' => getenv('APP_NAME') ?: 'Tilezilla',
        'from_email' => getenv('APP_FROM_EMAIL') ?: 'words@skifflakegames.com',
        'base_url' => rtrim(getenv('APP_BASE_URL') ?: 'http://localhost:3000', '/'),
        'admin_notify_email' => getenv('APP_ADMIN_EMAIL') ?: 'gar@hotmail.ca',
    ],
    'smtp' => [
        'enabled' => filter_var(getenv('SMTP_ENABLED') ?: 'true', FILTER_VALIDATE_BOOLEAN),
        'host' => getenv('SMTP_HOST') ?: 'mail.skifflakegames.com',
        'port' => (int) (getenv('SMTP_PORT') ?: 587),
        'tls' => getenv('SMTP_TLS') ?: 'none',
        'user' => getenv('SMTP_USER') ?: '',
        'password' => getenv('SMTP_PASS') ?: '',
    ],
];

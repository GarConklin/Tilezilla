<?php
// Local/docker defaults — edit for production. Mirrors config.example.php.

return [
    'db' => [
        'host' => getenv('DB_HOST') ?: 'words_db',
        'username' => getenv('DB_USER') ?: 'wordsgame',
        'password' => getenv('DB_PASS') ?: 'wordspass123',
        'database' => getenv('DB_NAME') ?: 'WordsOnline',
    ],
    'game_db' => [
        'host' => getenv('GAME_DB_HOST') ?: 'garz-puzzle-mysql',
        'username' => getenv('GAME_DB_USER') ?: 'tilegame',
        'password' => getenv('GAME_DB_PASS') ?: 'tilegame_dev',
        'database' => getenv('GAME_DB_NAME') ?: 'tilegame',
    ],
    'app' => [
        'name' => getenv('APP_NAME') ?: 'Tilezilla',
        'from_email' => getenv('APP_FROM_EMAIL') ?: 'words@skifflakegames.com',
        'base_url' => rtrim(getenv('APP_BASE_URL') ?: 'http://localhost:8081', '/'),
        'admin_notify_email' => getenv('APP_ADMIN_EMAIL') ?: 'gar@hotmail.ca',
    ],
];

<?php
/**
 * Tilezilla database connection — single tilegame database for auth + game data.
 */

class Db {
    /** @return array{host?:string,username?:string,password?:string,database?:string} */
    public static function config(array $config): array {
        if (!empty($config['game_db']['database'])) {
            return $config['game_db'];
        }
        return $config['db'] ?? [];
    }

    public static function connect(array $config): mysqli {
        $db = self::config($config);
        if (empty($db['host']) || empty($db['database'])) {
            throw new Exception('Database configuration missing');
        }

        $conn = new mysqli(
            $db['host'],
            $db['username'] ?? '',
            $db['password'] ?? '',
            $db['database']
        );

        if ($conn->connect_error) {
            throw new Exception('Database connection failed');
        }

        $conn->set_charset('utf8mb4');
        return $conn;
    }
}

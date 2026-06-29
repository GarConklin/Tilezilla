<?php
/**
 * Guest code registry + account conversion (Tilezilla).
 *
 * - guest_users lives in tilegame (game_db)
 * - users.guest_code lives in WordsOnline (auth db)
 */

class GuestManager {
    private $authConn;
    private $gameConn;
    private $hasAuthGuestColumn = null;
    private $hasGuestUsersTable = null;

    public function __construct(array $config) {
        $this->authConn = $this->connect($config['db'] ?? []);
        $this->gameConn = $this->connect($config['game_db'] ?? []);
    }

    public function __destruct() {
        if ($this->authConn instanceof mysqli) {
            $this->authConn->close();
        }
        if ($this->gameConn instanceof mysqli) {
            $this->gameConn->close();
        }
    }

    public static function normalizeGuestCode($raw) {
        $code = trim((string)$raw);
        if ($code === '') {
            return null;
        }
        if (!preg_match('/^Guest-TZ-A\d{4}-[A-Z]{2}$/', $code)) {
            return null;
        }
        return $code;
    }

    /**
     * Upsert guest_users row and refresh last_seen (Guest Created / session start).
     */
    public function touchGuest($guestCode) {
        $code = self::normalizeGuestCode($guestCode);
        if (!$code || !$this->ensureGuestUsersTable()) {
            return false;
        }

        $stmt = $this->gameConn->prepare(
            "INSERT INTO guest_users (guest_code, created_at, last_seen)
             VALUES (?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE last_seen = NOW()"
        );
        if (!$stmt) {
            error_log('GuestManager touchGuest prepare failed: ' . $this->gameConn->error);
            return false;
        }
        $stmt->bind_param('s', $code);
        $ok = $stmt->execute();
        if (!$ok) {
            error_log('GuestManager touchGuest execute failed: ' . $stmt->error);
        }
        $stmt->close();
        return $ok;
    }

    /**
     * Link a guest code to a WordsOnline user at register/login.
     * Only sets users.guest_code when currently empty (first conversion wins).
     */
    public function linkGuestToUser($wordsUserId, $guestCode, $source = 'login') {
        $code = self::normalizeGuestCode($guestCode);
        $userId = (int)$wordsUserId;
        if (!$code || $userId <= 0) {
            return null;
        }

        $this->touchGuest($code);

        $linkedOnUser = false;
        if ($this->ensureAuthGuestColumn()) {
            $stmt = $this->authConn->prepare(
                "UPDATE users SET guest_code = ?
                 WHERE id = ? AND (guest_code IS NULL OR guest_code = '')"
            );
            if ($stmt) {
                $stmt->bind_param('si', $code, $userId);
                $stmt->execute();
                $linkedOnUser = $stmt->affected_rows > 0;
                $stmt->close();
            }
        }

        if ($this->ensureGuestUsersTable()) {
            $stmt = $this->gameConn->prepare(
                "UPDATE guest_users
                 SET words_user_id = ?, converted_at = COALESCE(converted_at, NOW()), last_seen = NOW()
                 WHERE guest_code = ?"
            );
            if ($stmt) {
                $stmt->bind_param('is', $userId, $code);
                $stmt->execute();
                $stmt->close();
            }
        }

        error_log(sprintf(
            'GuestManager link (%s): user=%d guest=%s linked_on_user=%s',
            $source,
            $userId,
            $code,
            $linkedOnUser ? 'yes' : 'existing'
        ));

        return $code;
    }

    public function getGuestCodeForUser($wordsUserId) {
        $userId = (int)$wordsUserId;
        if ($userId <= 0 || !$this->ensureAuthGuestColumn()) {
            return null;
        }
        $stmt = $this->authConn->prepare('SELECT guest_code FROM users WHERE id = ? LIMIT 1');
        if (!$stmt) {
            return null;
        }
        $stmt->bind_param('i', $userId);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result ? $result->fetch_assoc() : null;
        $stmt->close();
        $code = self::normalizeGuestCode($row['guest_code'] ?? '');
        return $code ?: null;
    }

    private function connect(array $dbConfig) {
        if (empty($dbConfig['host']) || empty($dbConfig['database'])) {
            return null;
        }
        $conn = @new mysqli(
            $dbConfig['host'],
            $dbConfig['username'] ?? '',
            $dbConfig['password'] ?? '',
            $dbConfig['database']
        );
        if ($conn->connect_error) {
            error_log('GuestManager DB connect failed: ' . $conn->connect_error);
            return null;
        }
        $conn->set_charset('utf8mb4');
        return $conn;
    }

    private function ensureAuthGuestColumn() {
        if ($this->hasAuthGuestColumn !== null) {
            return $this->hasAuthGuestColumn;
        }
        if (!$this->authConn) {
            $this->hasAuthGuestColumn = false;
            return false;
        }
        $db = $this->authConn->real_escape_string($this->authConn->query('SELECT DATABASE()')->fetch_row()[0] ?? '');
        $res = $this->authConn->query(
            "SELECT COUNT(*) AS c FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = '{$db}' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'guest_code'"
        );
        $row = $res ? $res->fetch_assoc() : null;
        $this->hasAuthGuestColumn = ((int)($row['c'] ?? 0)) > 0;
        return $this->hasAuthGuestColumn;
    }

    private function ensureGuestUsersTable() {
        if ($this->hasGuestUsersTable !== null) {
            return $this->hasGuestUsersTable;
        }
        if (!$this->gameConn) {
            $this->hasGuestUsersTable = false;
            return false;
        }
        $db = $this->gameConn->real_escape_string($this->gameConn->query('SELECT DATABASE()')->fetch_row()[0] ?? '');
        $res = $this->gameConn->query(
            "SELECT COUNT(*) AS c FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = '{$db}' AND TABLE_NAME = 'guest_users'"
        );
        $row = $res ? $res->fetch_assoc() : null;
        $this->hasGuestUsersTable = ((int)($row['c'] ?? 0)) > 0;
        return $this->hasGuestUsersTable;
    }
}

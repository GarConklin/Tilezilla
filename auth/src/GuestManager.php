<?php
/**
 * Guest code registry + account conversion (Tilezilla).
 *
 * guest_users and users.guest_code both live in tilegame.
 */

require_once __DIR__ . '/Db.php';

class GuestManager {
    private $conn;
    private $hasGuestCodeColumn = null;
    private $hasGuestUsersTable = null;

    public function __construct(array $config) {
        $this->conn = Db::connect($config);
    }

    public function __destruct() {
        if ($this->conn instanceof mysqli) {
            $this->conn->close();
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

        $stmt = $this->conn->prepare(
            "INSERT INTO guest_users (guest_code, created_at, last_seen)
             VALUES (?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE last_seen = NOW()"
        );
        if (!$stmt) {
            error_log('GuestManager touchGuest prepare failed: ' . $this->conn->error);
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
     * Link a guest code to a registered user at register/login.
     * Only sets users.guest_code when currently empty (first conversion wins).
     */
    public function linkGuestToUser($userId, $guestCode, $source = 'login') {
        $code = self::normalizeGuestCode($guestCode);
        $userId = (int)$userId;
        if (!$code || $userId <= 0) {
            return null;
        }

        $this->touchGuest($code);

        $linkedOnUser = false;
        if ($this->ensureGuestCodeColumn()) {
            $stmt = $this->conn->prepare(
                "UPDATE users SET guest_code = ?
                 WHERE user_id = ? AND (guest_code IS NULL OR guest_code = '')"
            );
            if ($stmt) {
                $stmt->bind_param('si', $code, $userId);
                $stmt->execute();
                $linkedOnUser = $stmt->affected_rows > 0;
                $stmt->close();
            }
        }

        if ($this->ensureGuestUsersTable()) {
            $stmt = $this->conn->prepare(
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

    public function getGuestCodeForUser($userId) {
        $userId = (int)$userId;
        if ($userId <= 0 || !$this->ensureGuestCodeColumn()) {
            return null;
        }
        $stmt = $this->conn->prepare('SELECT guest_code FROM users WHERE user_id = ? LIMIT 1');
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

    private function ensureGuestCodeColumn() {
        if ($this->hasGuestCodeColumn !== null) {
            return $this->hasGuestCodeColumn;
        }
        $db = $this->conn->real_escape_string($this->conn->query('SELECT DATABASE()')->fetch_row()[0] ?? '');
        $res = $this->conn->query(
            "SELECT COUNT(*) AS c FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = '{$db}' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'guest_code'"
        );
        $row = $res ? $res->fetch_assoc() : null;
        $this->hasGuestCodeColumn = ((int)($row['c'] ?? 0)) > 0;
        return $this->hasGuestCodeColumn;
    }

    private function ensureGuestUsersTable() {
        if ($this->hasGuestUsersTable !== null) {
            return $this->hasGuestUsersTable;
        }
        $db = $this->conn->real_escape_string($this->conn->query('SELECT DATABASE()')->fetch_row()[0] ?? '');
        $res = $this->conn->query(
            "SELECT COUNT(*) AS c FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = '{$db}' AND TABLE_NAME = 'guest_users'"
        );
        $row = $res ? $res->fetch_assoc() : null;
        $this->hasGuestUsersTable = ((int)($row['c'] ?? 0)) > 0;
        return $this->hasGuestUsersTable;
    }
}

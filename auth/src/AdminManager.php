<?php

require_once __DIR__ . '/HintManager.php';

class AdminManager {
    private $conn;

    public function __construct($conn) {
        $this->conn = $conn;
    }

    public function listUsers(string $query = '', int $limit = 100): array {
        $limit = max(1, min(200, $limit));
        $like = '%' . $query . '%';

        if ($query !== '') {
            $stmt = $this->conn->prepare(
                "SELECT user_id, username, player_name, email, status, paid, is_admin,
                        email_verified, active_until, hint_tokens, created_at, last_login
                 FROM users
                 WHERE username LIKE ? OR email LIKE ? OR CAST(user_id AS CHAR) LIKE ?
                    OR player_name LIKE ?
                 ORDER BY user_id DESC
                 LIMIT ?"
            );
            $stmt->bind_param('ssssi', $like, $like, $like, $like, $limit);
        } else {
            $stmt = $this->conn->prepare(
                "SELECT user_id, username, player_name, email, status, paid, is_admin,
                        email_verified, active_until, hint_tokens, created_at, last_login
                 FROM users
                 ORDER BY user_id DESC
                 LIMIT ?"
            );
            $stmt->bind_param('i', $limit);
        }

        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        return array_map([$this, 'formatUser'], $rows ?: []);
    }

    public function getUser(int $userId): ?array {
        $stmt = $this->conn->prepare(
            "SELECT user_id, username, player_name, email, status, paid, is_admin,
                    email_verified, active_until, hint_tokens, created_at, last_login, guest_code
             FROM users WHERE user_id = ? LIMIT 1"
        );
        $stmt->bind_param('i', $userId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $row ? $this->formatUser($row) : null;
    }

    public function updateUser(int $userId, array $fields): array {
        $allowed = [
            'username', 'player_name', 'email', 'status', 'paid', 'is_admin',
            'email_verified', 'active_until',
        ];
        $sets = [];
        $types = '';
        $values = [];

        foreach ($allowed as $key) {
            if (!array_key_exists($key, $fields)) {
                continue;
            }
            $value = $fields[$key];
            if ($key === 'username' || $key === 'player_name' || $key === 'email' || $key === 'status') {
                $value = trim((string) $value);
            }
            if ($key === 'username') {
                $this->validateUsername($value);
                $this->assertUsernameAvailable($value, $userId);
            }
            if ($key === 'email') {
                $this->validateEmail($value);
                $this->assertEmailAvailable($value, $userId);
            }
            if ($key === 'status') {
                $this->validateStatus($value);
            }
            if (in_array($key, ['paid', 'is_admin', 'email_verified'], true)) {
                $value = $fields[$key] ? 1 : 0;
                $types .= 'i';
            } elseif ($key === 'active_until') {
                if ($value === null || $value === '') {
                    $sets[] = 'active_until = NULL';
                    continue;
                }
                $types .= 's';
            } else {
                $types .= 's';
            }
            $sets[] = "$key = ?";
            $values[] = $value;
        }

        if (!$sets) {
            throw new Exception('No valid fields to update');
        }

        $sql = 'UPDATE users SET ' . implode(', ', $sets) . ' WHERE user_id = ?';
        $types .= 'i';
        $values[] = $userId;

        $stmt = $this->conn->prepare($sql);
        $stmt->bind_param($types, ...$values);
        if (!$stmt->execute()) {
            throw new Exception('Failed to update user: ' . $stmt->error);
        }
        $stmt->close();

        return $this->getUser($userId);
    }

    public function setPassword(int $userId, string $password): void {
        if (strlen($password) < 6) {
            throw new Exception('Password must be at least 6 characters');
        }
        if (!$this->getUser($userId)) {
            throw new Exception('User not found');
        }
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $this->conn->prepare('UPDATE users SET password_hash = ? WHERE user_id = ?');
        $stmt->bind_param('si', $hash, $userId);
        if (!$stmt->execute()) {
            throw new Exception('Failed to reset password');
        }
        $stmt->close();
    }

    public function grantHints(int $userId, int $amount, string $reason, int $adminId): array {
        if (!$this->getUser($userId)) {
            throw new Exception('User not found');
        }

        $reason = trim($reason) ?: 'Admin Grant';
        $hintManager = new HintManager($this->conn);
        $hintManager->applyTransaction($userId, $amount, $reason, 'admin:' . $adminId);

        return $this->getUser($userId);
    }

    public function deleteUser(int $userId, int $adminId): void {
        if ($userId === $adminId) {
            throw new Exception('You cannot delete your own account');
        }
        if (!$this->getUser($userId)) {
            throw new Exception('User not found');
        }

        $tables = [
            'hint_transactions',
            'user_solution_discoveries',
            'user_level_progress',
            'daily_results',
            'user_encountered_tiles',
        ];

        $this->conn->begin_transaction();
        try {
            foreach ($tables as $table) {
                $col = $table === 'user_encountered_tiles' ? 'words_user_id' : 'user_id';
                $stmt = $this->conn->prepare("DELETE FROM `$table` WHERE `$col` = ?");
                $stmt->bind_param('i', $userId);
                $stmt->execute();
                $stmt->close();
            }

            $stmt = $this->conn->prepare('DELETE FROM player_progress WHERE player_id = ?');
            $stmt->bind_param('i', $userId);
            $stmt->execute();
            $stmt->close();

            $stmt = $this->conn->prepare('UPDATE guest_users SET words_user_id = NULL WHERE words_user_id = ?');
            $stmt->bind_param('i', $userId);
            $stmt->execute();
            $stmt->close();

            $stmt = $this->conn->prepare('DELETE FROM tile_profiles WHERE words_user_id = ?');
            $stmt->bind_param('i', $userId);
            $stmt->execute();
            $stmt->close();

            $stmt = $this->conn->prepare('DELETE FROM users WHERE user_id = ?');
            $stmt->bind_param('i', $userId);
            if (!$stmt->execute() || $stmt->affected_rows < 1) {
                throw new Exception('Failed to delete user');
            }
            $stmt->close();

            $this->conn->commit();
        } catch (Exception $e) {
            $this->conn->rollback();
            throw $e;
        }
    }

    private function formatUser(array $row): array {
        return [
            'id' => (int) $row['user_id'],
            'username' => $row['username'],
            'player_name' => $row['player_name'] ?? $row['username'],
            'email' => $row['email'],
            'status' => $row['status'],
            'paid' => (bool) ($row['paid'] ?? false),
            'is_admin' => (bool) ($row['is_admin'] ?? false),
            'email_verified' => (bool) ($row['email_verified'] ?? false),
            'active_until' => $row['active_until'],
            'hint_tokens' => (int) ($row['hint_tokens'] ?? 0),
            'created_at' => $row['created_at'] ?? null,
            'last_login' => $row['last_login'] ?? null,
            'guest_code' => $row['guest_code'] ?? null,
        ];
    }

    private function validateUsername(string $username): void {
        if (strlen($username) < 3 || strlen($username) > 30) {
            throw new Exception('Username must be 3–30 characters');
        }
        if (!preg_match('/^[a-zA-Z0-9_-]+$/', $username)) {
            throw new Exception('Username has invalid characters');
        }
    }

    private function validateEmail(string $email): void {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new Exception('Invalid email');
        }
        if (strlen($email) > 255) {
            throw new Exception('Email too long');
        }
    }

    private function validateStatus(string $status): void {
        $allowed = ['active', 'registered', 'suspended', 'expired'];
        if (!in_array($status, $allowed, true)) {
            throw new Exception('Invalid status');
        }
    }

    private function assertUsernameAvailable(string $username, int $exceptUserId): void {
        $stmt = $this->conn->prepare(
            'SELECT user_id FROM users WHERE username = ? AND user_id <> ? LIMIT 1'
        );
        $stmt->bind_param('si', $username, $exceptUserId);
        $stmt->execute();
        $exists = $stmt->get_result()->num_rows > 0;
        $stmt->close();
        if ($exists) {
            throw new Exception('Username already taken');
        }
    }

    private function assertEmailAvailable(string $email, int $exceptUserId): void {
        $stmt = $this->conn->prepare(
            'SELECT user_id FROM users WHERE email = ? AND user_id <> ? LIMIT 1'
        );
        $stmt->bind_param('si', $email, $exceptUserId);
        $stmt->execute();
        $exists = $stmt->get_result()->num_rows > 0;
        $stmt->close();
        if ($exists) {
            throw new Exception('Email already in use');
        }
    }
}

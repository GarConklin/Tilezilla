<?php

require_once __DIR__ . '/Db.php';

class AdminGuard {
    /**
     * @return array{conn: mysqli, admin_id: int}
     */
    public static function requireAdmin(array $config): array {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        if (empty($_SESSION['user_id'])) {
            self::deny(401, 'Not authenticated');
        }

        $adminId = (int) $_SESSION['user_id'];
        $conn = Db::connect($config);

        $stmt = $conn->prepare('SELECT is_admin FROM users WHERE user_id = ? LIMIT 1');
        if (!$stmt) {
            self::deny(500, 'Database error');
        }
        $stmt->bind_param('i', $adminId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$row || !(int) ($row['is_admin'] ?? 0)) {
            $conn->close();
            self::deny(403, 'Admin access required');
        }

        return ['conn' => $conn, 'admin_id' => $adminId];
    }

    private static function deny(int $code, string $message): void {
        http_response_code($code);
        echo json_encode(['success' => false, 'error' => $message]);
        exit;
    }
}

<?php
header('Content-Type: application/json');
session_start();

require_once __DIR__ . '/../src/Db.php';
require_once __DIR__ . '/../src/AuthManager.php';
require_once __DIR__ . '/../src/GuestManager.php';
$config = require __DIR__ . '/../config/config.php';

try {
    $conn = Db::connect($config);
    $authManager = new AuthManager($conn);
    $user = $authManager->verifySession();
    $conn->close();

    if (!$user) {
        echo json_encode(['success' => true, 'authenticated' => false]);
        exit;
    }

    echo json_encode([
        'success' => true,
        'authenticated' => true,
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'paid' => (bool)$user['paid'],
            'is_admin' => (bool)($user['is_admin'] ?? false),
            'hint_tokens' => (int)($user['hint_tokens'] ?? 0),
            'player_name' => $user['player_name'] ?? $user['username'],
            'guest_code' => GuestManager::normalizeGuestCode($user['guest_code'] ?? '') ?: null,
        ],
    ]);
} catch (Exception $e) {
    error_log("Tilezilla session check error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Session verification failed']);
}

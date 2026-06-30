<?php
header('Content-Type: application/json');

require_once __DIR__ . '/../../src/AdminGuard.php';
require_once __DIR__ . '/../../src/AdminManager.php';
$config = require __DIR__ . '/../../config/config.php';

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        throw new Exception('Invalid JSON body');
    }

    $userId = (int) ($input['user_id'] ?? $input['id'] ?? 0);
    $amount = (int) ($input['amount'] ?? 0);
    $reason = trim((string) ($input['reason'] ?? 'Admin Grant'));
    if ($userId < 1) {
        throw new Exception('User id is required');
    }

    $ctx = AdminGuard::requireAdmin($config);
    $manager = new AdminManager($ctx['conn']);
    $user = $manager->grantHints($userId, $amount, $reason, $ctx['admin_id']);
    $ctx['conn']->close();

    echo json_encode(['success' => true, 'user' => $user]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

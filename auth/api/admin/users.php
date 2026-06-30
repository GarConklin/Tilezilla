<?php
header('Content-Type: application/json');

require_once __DIR__ . '/../../src/AdminGuard.php';
require_once __DIR__ . '/../../src/AdminManager.php';
$config = require __DIR__ . '/../../config/config.php';

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        exit;
    }

    $ctx = AdminGuard::requireAdmin($config);
    $manager = new AdminManager($ctx['conn']);
    $query = trim($_GET['q'] ?? '');
    $limit = (int) ($_GET['limit'] ?? 100);
    $users = $manager->listUsers($query, $limit);
    $ctx['conn']->close();

    echo json_encode(['success' => true, 'users' => $users]);
} catch (Exception $e) {
    error_log('Tilezilla admin users list: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to list users']);
}

<?php
header('Content-Type: application/json');

require_once __DIR__ . '/../../src/AdminGuard.php';
require_once __DIR__ . '/../../src/AdminManager.php';
$config = require __DIR__ . '/../../config/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $ctx = AdminGuard::requireAdmin($config);
    $manager = new AdminManager($ctx['conn']);
    $adminId = $ctx['admin_id'];

    if ($method === 'GET') {
        $userId = (int) ($_GET['id'] ?? 0);
        if ($userId < 1) {
            throw new Exception('User id required');
        }
        $user = $manager->getUser($userId);
        if (!$user) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'User not found']);
            exit;
        }
        echo json_encode(['success' => true, 'user' => $user]);
        exit;
    }

    if ($method === 'PATCH') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!is_array($input)) {
            throw new Exception('Invalid JSON body');
        }
        $userId = (int) ($input['id'] ?? 0);
        if ($userId < 1) {
            throw new Exception('User id required');
        }
        unset($input['id']);
        $user = $manager->updateUser($userId, $input);
        echo json_encode(['success' => true, 'user' => $user]);
        exit;
    }

    if ($method === 'DELETE') {
        $userId = (int) ($_GET['id'] ?? 0);
        if ($userId < 1) {
            $body = json_decode(file_get_contents('php://input'), true);
            $userId = (int) ($body['id'] ?? 0);
        }
        if ($userId < 1) {
            throw new Exception('User id required');
        }
        $manager->deleteUser($userId, $adminId);
        echo json_encode(['success' => true]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
} catch (Exception $e) {
    $code = 400;
    $msg = $e->getMessage();
    if ($msg === 'User not found') {
        $code = 404;
    }
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
} finally {
    if (isset($ctx['conn'])) {
        $ctx['conn']->close();
    }
}

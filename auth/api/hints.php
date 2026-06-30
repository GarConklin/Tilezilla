<?php
header('Content-Type: application/json');
session_start();

require_once __DIR__ . '/../src/Db.php';
require_once __DIR__ . '/../src/AuthManager.php';
require_once __DIR__ . '/../src/HintManager.php';
$config = require __DIR__ . '/../config/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $conn = Db::connect($config);
    $authManager = new AuthManager($conn);
    $user = $authManager->verifySession();
    if (!$user) {
        $conn->close();
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Not authenticated']);
        exit;
    }

    $userId = (int) $user['id'];
    $hintManager = new HintManager($conn);

    if ($method === 'GET') {
        $balance = $hintManager->getBalance($userId);
        $conn->close();
        echo json_encode(['success' => true, 'hint_tokens' => $balance]);
        exit;
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!is_array($input)) {
            throw new Exception('Invalid JSON body');
        }

        $amount = (int) ($input['amount'] ?? 0);
        $reason = (string) ($input['reason'] ?? '');
        $referenceId = isset($input['reference_id']) ? (string) $input['reference_id'] : null;

        $result = $hintManager->applyTransaction($userId, $amount, $reason, $referenceId);
        $conn->close();

        echo json_encode([
            'success' => true,
            'hint_tokens' => $result['hint_tokens'],
            'transaction_id' => $result['transaction_id'],
        ]);
        exit;
    }

    $conn->close();
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
} catch (Exception $e) {
    if (isset($conn)) {
        $conn->close();
    }
    $msg = $e->getMessage();
    $code = 400;
    if ($msg === 'Not authenticated') {
        $code = 401;
    } elseif ($msg === 'Not enough hint tokens') {
        $code = 409;
    }
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
}

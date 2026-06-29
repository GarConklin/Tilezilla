<?php
header('Content-Type: application/json');
session_start();

require_once __DIR__ . '/../src/Db.php';
require_once __DIR__ . '/../src/AuthManager.php';
require_once __DIR__ . '/../src/GuestManager.php';
require_once __DIR__ . '/../src/EncounteredTilesManager.php';
$config = require __DIR__ . '/../config/config.php';

try {
    $manager = new EncounteredTilesManager($config);
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') {
        $conn = Db::connect($config);
        $authManager = new AuthManager($conn);
        $user = $authManager->verifySession();
        $conn->close();

        if ($user) {
            $tiles = $manager->listForUser($user['id']);
            echo json_encode([
                'success' => true,
                'player_kind' => 'registered',
                'tiles' => $tiles,
            ]);
            exit;
        }

        $input = $_GET;
        if (empty($input['guest_code'])) {
            $body = json_decode(file_get_contents('php://input'), true);
            if (is_array($body)) {
                $input = array_merge($input, $body);
            }
        }
        $guestCode = GuestManager::normalizeGuestCode($input['guest_code'] ?? '');
        if (!$guestCode) {
            echo json_encode(['success' => true, 'player_kind' => 'anonymous', 'tiles' => []]);
            exit;
        }

        echo json_encode([
            'success' => true,
            'player_kind' => 'guest',
            'guest_code' => $guestCode,
            'tiles' => $manager->listForGuest($guestCode),
        ]);
        exit;
    }

    if ($method !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        throw new Exception('Invalid JSON body');
    }
    $tileIds = $input['tiles'] ?? [];
    if (!is_array($tileIds)) {
        throw new Exception('tiles must be an array');
    }

    $conn = Db::connect($config);
    $authManager = new AuthManager($conn);
    $user = $authManager->verifySession();
    $conn->close();

    if ($user) {
        $newly = $manager->recordForUser($user['id'], $tileIds);
        echo json_encode([
            'success' => true,
            'player_kind' => 'registered',
            'new_tiles' => $newly,
            'tiles' => $manager->listForUser($user['id']),
        ]);
        exit;
    }

    $guestCode = GuestManager::normalizeGuestCode($input['guest_code'] ?? '');
    if (!$guestCode) {
        throw new Exception('Login required or provide guest_code');
    }

    $guestManager = new GuestManager($config);
    $guestManager->touchGuest($guestCode);
    $newly = $manager->recordForGuest($guestCode, $tileIds);
    echo json_encode([
        'success' => true,
        'player_kind' => 'guest',
        'guest_code' => $guestCode,
        'new_tiles' => $newly,
        'tiles' => $manager->listForGuest($guestCode),
    ]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

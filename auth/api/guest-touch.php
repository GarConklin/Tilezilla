<?php
header('Content-Type: application/json');

require_once __DIR__ . '/../src/GuestManager.php';
$config = require __DIR__ . '/../config/config.php';

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $guestCode = GuestManager::normalizeGuestCode($input['guest_code'] ?? '');

    if (!$guestCode) {
        throw new Exception('Invalid guest code');
    }

    $guestManager = new GuestManager($config);
    $ok = $guestManager->touchGuest($guestCode);

    echo json_encode([
        'success' => (bool)$ok,
        'guest_code' => $guestCode,
    ]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

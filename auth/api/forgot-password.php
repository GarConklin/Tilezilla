<?php
header('Content-Type: application/json');
$config = require __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/Db.php';

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $identifier = trim($input['identifier'] ?? '');

    if (empty($identifier)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Please enter your username or email']);
        exit;
    }

    $conn = Db::connect($config);

    $isEmail = filter_var($identifier, FILTER_VALIDATE_EMAIL);
    if ($isEmail) {
        $stmt = $conn->prepare("SELECT user_id, username, email FROM users WHERE email = ?");
    } else {
        $stmt = $conn->prepare("SELECT user_id, username, email FROM users WHERE username = ?");
    }
    $stmt->bind_param("s", $identifier);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($user) {
        $userId = (int)$user['user_id'];
        $stmt = $conn->prepare(
            "SELECT password_reset_expires FROM users WHERE user_id = ? AND password_reset_token IS NOT NULL
             AND password_reset_expires > DATE_ADD(NOW(), INTERVAL 13 MINUTE)"
        );
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $rateLimited = $stmt->get_result()->num_rows > 0;
        $stmt->close();

        if (!$rateLimited) {
            $resetToken = bin2hex(random_bytes(32));
            $expiresAt = date('Y-m-d H:i:s', strtotime('+15 minutes'));
            $stmt = $conn->prepare(
                "UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE user_id = ?"
            );
            $stmt->bind_param("ssi", $resetToken, $expiresAt, $userId);
            $stmt->execute();
            $stmt->close();

            require_once __DIR__ . '/../src/EmailNotifier.php';
            EmailNotifier::sendPasswordResetEmail(
                $user['email'],
                $user['username'],
                $resetToken,
                $config['app']['base_url'] ?? null
            );
        }
    }

    $conn->close();
    echo json_encode([
        'success' => true,
        'message' => 'If an account exists, a reset link has been sent.',
    ]);
} catch (Exception $e) {
    error_log("Tilezilla forgot password error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'An error occurred. Please try again.']);
}

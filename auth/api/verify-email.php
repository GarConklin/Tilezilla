<?php
header('Content-Type: application/json');
$config = require __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/Db.php';

try {
    $token = trim($_GET['token'] ?? '');
    if (!$token) {
        throw new Exception("Verification token is required");
    }

    $conn = Db::connect($config);
    $appName = $config['app']['name'] ?? 'Tilezilla';

    $stmt = $conn->prepare(
        "SELECT user_id, username, email, email_verified, status FROM users WHERE verification_token = ?"
    );
    $stmt->bind_param("s", $token);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        throw new Exception("Invalid or expired verification token");
    }

    $user = $result->fetch_assoc();
    $userId = (int)$user['user_id'];
    $stmt->close();

    $activateFreeAccount = function () use ($conn, $userId) {
        $activateStmt = $conn->prepare("
            UPDATE users
            SET paid = TRUE, status = 'active', active_until = NULL
            WHERE user_id = ?
        ");
        $activateStmt->bind_param("i", $userId);
        $activateStmt->execute();
        $activateStmt->close();
    };

    if ($user['email_verified']) {
        if (($user['status'] ?? '') === 'registered') {
            $activateFreeAccount();
        }
        $conn->close();
        echo json_encode([
            'success' => true,
            'message' => 'Email already verified. You can log in.',
            'already_verified' => true,
            'username' => $user['username'],
        ]);
        exit;
    }

    $updateStmt = $conn->prepare(
        "UPDATE users SET email_verified = TRUE, verification_token = NULL WHERE user_id = ?"
    );
    $updateStmt->bind_param("i", $userId);
    if (!$updateStmt->execute()) {
        throw new Exception("Failed to verify email");
    }
    $updateStmt->close();

    $activateFreeAccount();

    $message = "Welcome to $appName, {$user['username']}! Your email is verified and your account is ready to play.";

    $conn->close();

    echo json_encode([
        'success' => true,
        'message' => $message,
        'user_id' => $userId,
        'username' => $user['username'],
    ]);
} catch (Exception $e) {
    error_log("Tilezilla verify email error: " . $e->getMessage());
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

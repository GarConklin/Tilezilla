<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
$config = require __DIR__ . '/../config/config.php';

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $token = trim($input['token'] ?? '');
    $newPassword = $input['password'] ?? '';

    if (empty($token) || empty($newPassword)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Token and password are required']);
        exit;
    }

    if (strlen($newPassword) < 6) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Password must be at least 6 characters']);
        exit;
    }

    $conn = new mysqli(
        $config['db']['host'],
        $config['db']['username'],
        $config['db']['password'],
        $config['db']['database']
    );

    if ($conn->connect_error) {
        throw new Exception("Database connection failed");
    }

    $stmt = $conn->prepare(
        "SELECT id FROM users WHERE password_reset_token = ? AND password_reset_expires > NOW()"
    );
    $stmt->bind_param("s", $token);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid or expired reset token']);
        exit;
    }

    $user = $result->fetch_assoc();
    $stmt->close();

    $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
    $stmt = $conn->prepare(
        "UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?"
    );
    $stmt->bind_param("si", $passwordHash, $user['id']);
    $stmt->execute();
    $stmt->close();
    $conn->close();

    echo json_encode(['success' => true, 'message' => 'Password reset successfully']);
} catch (Exception $e) {
    error_log("Tilezilla reset password error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to reset password']);
}

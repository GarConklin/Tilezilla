<?php
header('Content-Type: application/json');
session_start();

require_once __DIR__ . '/../src/AuthManager.php';
$config = require __DIR__ . '/../config/config.php';

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $usernameOrEmail = trim($input['username'] ?? '');
    $password = $input['password'] ?? '';

    if (!$usernameOrEmail || !$password) {
        throw new Exception("Username/Email and password are required");
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

    $isEmail = filter_var($usernameOrEmail, FILTER_VALIDATE_EMAIL);
    if ($isEmail) {
        $stmt = $conn->prepare("SELECT id, username, email, password_hash, paid, status, is_admin, active_until, email_verified FROM users WHERE email = ?");
    } else {
        $stmt = $conn->prepare("SELECT id, username, email, password_hash, paid, status, is_admin, active_until, email_verified FROM users WHERE username = ?");
    }

    $stmt->bind_param("s", $usernameOrEmail);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        throw new Exception("Invalid username/email or password");
    }

    $user = $result->fetch_assoc();
    $stmt->close();

    if (!password_verify($password, $user['password_hash'])) {
        throw new Exception("Invalid username/email or password");
    }

    if (isset($user['status']) && $user['status'] === 'suspended') {
        throw new Exception("Account is suspended");
    }

    if (isset($user['status']) && $user['status'] === 'expired') {
        throw new Exception("Your account has expired.");
    }

    if (empty($user['email_verified'])) {
        throw new Exception("Please verify your email before logging in.");
    }

    if (isset($user['status']) && $user['status'] === 'registered') {
        throw new Exception("Account is not yet activated.");
    }

    if (isset($user['active_until']) && $user['active_until'] !== null) {
        if (new DateTime($user['active_until']) < new DateTime()) {
            throw new Exception("Your subscription has expired.");
        }
    }

    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['email'] = $user['email'];
    $_SESSION['paid'] = (bool)$user['paid'];
    $_SESSION['is_admin'] = (bool)($user['is_admin'] ?? false);

    $updateStmt = $conn->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
    $updateStmt->bind_param("i", $user['id']);
    $updateStmt->execute();
    $updateStmt->close();
    $conn->close();

    echo json_encode([
        'success' => true,
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'paid' => (bool)$user['paid'],
        ],
    ]);
} catch (Exception $e) {
    error_log("Tilezilla login error: " . $e->getMessage());
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

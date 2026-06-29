<?php
header('Content-Type: application/json');
session_start();

require_once __DIR__ . '/../src/Db.php';
require_once __DIR__ . '/../src/AuthManager.php';
require_once __DIR__ . '/../src/GuestManager.php';
$config = require __DIR__ . '/../config/config.php';

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $usernameOrEmail = trim($input['username'] ?? '');
    $password = $input['password'] ?? '';

    if (!$usernameOrEmail || !$password) {
        throw new Exception("Username/Email and password are required");
    }

    $conn = Db::connect($config);

    $isEmail = filter_var($usernameOrEmail, FILTER_VALIDATE_EMAIL);
    if ($isEmail) {
        $stmt = $conn->prepare(
            "SELECT user_id, username, email, password_hash, paid, status, is_admin, active_until, email_verified, guest_code
             FROM users WHERE email = ?"
        );
    } else {
        $stmt = $conn->prepare(
            "SELECT user_id, username, email, password_hash, paid, status, is_admin, active_until, email_verified, guest_code
             FROM users WHERE username = ?"
        );
    }

    $stmt->bind_param("s", $usernameOrEmail);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        throw new Exception("Invalid username/email or password");
    }

    $row = $result->fetch_assoc();
    $stmt->close();

    if (!password_verify($password, $row['password_hash'])) {
        throw new Exception("Invalid username/email or password");
    }

    if (isset($row['status']) && $row['status'] === 'suspended') {
        throw new Exception("Account is suspended");
    }

    if (isset($row['status']) && $row['status'] === 'expired') {
        throw new Exception("Your account has expired.");
    }

    if (empty($row['email_verified'])) {
        throw new Exception("Please verify your email before logging in.");
    }

    if (isset($row['status']) && $row['status'] === 'registered') {
        throw new Exception("Account is not yet activated.");
    }

    if (isset($row['active_until']) && $row['active_until'] !== null) {
        if (new DateTime($row['active_until']) < new DateTime()) {
            throw new Exception("Your subscription has expired.");
        }
    }

    $userId = (int)$row['user_id'];
    $_SESSION['user_id'] = $userId;
    $_SESSION['username'] = $row['username'];
    $_SESSION['email'] = $row['email'];
    $_SESSION['paid'] = (bool)$row['paid'];
    $_SESSION['is_admin'] = (bool)($row['is_admin'] ?? false);

    $updateStmt = $conn->prepare("UPDATE users SET last_login = NOW() WHERE user_id = ?");
    $updateStmt->bind_param("i", $userId);
    $updateStmt->execute();
    $updateStmt->close();
    $conn->close();

    $guestCode = GuestManager::normalizeGuestCode($row['guest_code'] ?? '');
    $guestCodeInput = GuestManager::normalizeGuestCode($input['guest_code'] ?? '');
    if ($guestCodeInput) {
        $guestManager = new GuestManager($config);
        $linked = $guestManager->linkGuestToUser($userId, $guestCodeInput, 'login');
        if ($linked) {
            $guestCode = $linked;
        }
    }

    echo json_encode([
        'success' => true,
        'user' => [
            'id' => $userId,
            'username' => $row['username'],
            'email' => $row['email'],
            'paid' => (bool)$row['paid'],
            'guest_code' => $guestCode ?: null,
        ],
    ]);
} catch (Exception $e) {
    error_log("Tilezilla login error: " . $e->getMessage());
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

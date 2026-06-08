<?php
header('Content-Type: application/json');
session_start();

require_once __DIR__ . '/../src/AuthManager.php';
$config = require __DIR__ . '/../config/config.php';

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $username = trim($input['username'] ?? '');
    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';

    if (!$username || !$email || !$password) {
        throw new Exception("All fields are required");
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

    $authManager = new AuthManager($conn);
    $registerResult = $authManager->register($username, $email, $password);
    $userId = $registerResult['user_id'];
    $verificationToken = $registerResult['verification_token'];
    $conn->close();

    $responseData = [
        'success' => true,
        'message' => 'Account created. Please check your email to verify your account.',
        'user_id' => $userId,
        'email_verification_required' => true,
        'account_created' => true,
    ];

    echo json_encode($responseData);

    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    } else {
        flush();
    }

    require_once __DIR__ . '/../src/EmailNotifier.php';
    $baseUrl = $config['app']['base_url'] ?? null;
    EmailNotifier::sendVerificationEmail($email, $username, $verificationToken, $baseUrl);

    $adminEmail = $config['app']['admin_notify_email'] ?? null;
    if ($adminEmail) {
        EmailNotifier::sendRegistrationNotification($adminEmail, $username, $email);
    }
} catch (Exception $e) {
    error_log("Tilezilla registration error: " . $e->getMessage());
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

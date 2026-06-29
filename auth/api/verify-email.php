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

    if ($user['email_verified']) {
        if (($user['status'] ?? '') === 'registered') {
            $trialPeriodDays = 7;
            $settingsStmt = $conn->prepare(
                "SELECT setting_value FROM registration_settings WHERE setting_key = 'trial_period_days'"
            );
            if ($settingsStmt) {
                $settingsStmt->execute();
                $settingsResult = $settingsStmt->get_result();
                if ($settingsResult->num_rows > 0) {
                    $trialPeriodDays = (int)$settingsResult->fetch_assoc()['setting_value'];
                }
                $settingsStmt->close();
            }
            $activateStmt = $conn->prepare("
                UPDATE users SET paid = TRUE, status = 'active', active_until = DATE_ADD(CURDATE(), INTERVAL ? DAY)
                WHERE user_id = ?
            ");
            $activateStmt->bind_param("ii", $trialPeriodDays, $userId);
            $activateStmt->execute();
            $activateStmt->close();
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

    $trialPeriodDays = 7;
    $settingsStmt = $conn->prepare(
        "SELECT setting_value FROM registration_settings WHERE setting_key = 'trial_period_days'"
    );
    if ($settingsStmt) {
        $settingsStmt->execute();
        $settingsResult = $settingsStmt->get_result();
        if ($settingsResult->num_rows > 0) {
            $trialPeriodDays = (int)$settingsResult->fetch_assoc()['setting_value'];
        }
        $settingsStmt->close();
    }

    $bonusStmt = $conn->prepare("
        UPDATE users SET paid = TRUE, status = 'active', active_until = DATE_ADD(CURDATE(), INTERVAL ? DAY)
        WHERE user_id = ?
    ");
    $bonusStmt->bind_param("ii", $trialPeriodDays, $userId);
    $bonusStmt->execute();
    $bonusStmt->close();

    $appName = $config['app']['name'] ?? 'Tilezilla';
    $message = "Welcome to $appName, {$user['username']}! Your email is verified and your account is active for $trialPeriodDays days.";

    $conn->close();

    echo json_encode([
        'success' => true,
        'message' => $message,
        'user_id' => $userId,
        'username' => $user['username'],
        'trial_period_days' => $trialPeriodDays,
    ]);
} catch (Exception $e) {
    error_log("Tilezilla verify email error: " . $e->getMessage());
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

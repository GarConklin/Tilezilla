<?php
// Sends via PHP mail() → sendmail → words_mailserver (mailserver:587 on words_network).

class EmailNotifier {
    private static function appConfig() {
        static $app = null;
        if ($app === null) {
            $configPath = __DIR__ . '/../config/config.php';
            if (is_file($configPath)) {
                $config = require $configPath;
                $app = $config['app'] ?? [];
            } else {
                $app = [];
            }
        }
        return $app;
    }

    public static function send($to, $subject, $message, $fromEmail = null, $fromName = null) {
        $app = self::appConfig();
        if ($fromEmail === null) {
            $fromEmail = $app['from_email'] ?? 'words@skifflakegames.com';
        }
        if ($fromName === null) {
            $fromName = $app['name'] ?? 'Tilezilla';
        }

        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            error_log("EmailNotifier: Invalid recipient email: $to");
            return false;
        }

        $headers = [
            "From: $fromName <$fromEmail>",
            "Reply-To: $fromEmail",
            "X-Mailer: PHP/" . phpversion(),
            "MIME-Version: 1.0",
            "Content-Type: text/html; charset=UTF-8",
        ];

        $result = @mail($to, $subject, $message, implode("\r\n", $headers));
        if (!$result) {
            error_log("EmailNotifier: Failed to send email to $to");
        }
        return $result;
    }

    public static function sendRegistrationNotification($adminEmail, $username, $userEmail) {
        $app = self::appConfig();
        $appName = $app['name'] ?? 'Tilezilla';
        $subject = "New User Registration - $appName";
        $message = "
        <html><body style='font-family:Arial,sans-serif'>
            <h2>New User Registration</h2>
            <p>A new user registered for $appName:</p>
            <p><strong>Username:</strong> " . htmlspecialchars($username) . "</p>
            <p><strong>Email:</strong> " . htmlspecialchars($userEmail) . "</p>
            <p><strong>Time:</strong> " . date('Y-m-d H:i:s') . "</p>
        </body></html>";
        return self::send($adminEmail, $subject, $message);
    }

    public static function sendVerificationEmail($userEmail, $username, $verificationToken, $baseUrl = null) {
        $app = self::appConfig();
        $appName = $app['name'] ?? 'Tilezilla';

        if ($baseUrl === null) {
            $baseUrl = $app['base_url'] ?? null;
        }
        if ($baseUrl === null) {
            $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
            $baseUrl = $protocol . '://' . $host;
        }

        $verificationLink = rtrim($baseUrl, '/') . '/verify-email.html?token=' . urlencode($verificationToken);
        $template = "Hello [user],\n\nThank you for registering with $appName! Please verify your email to activate your account.\n\n[verify_link]\n\nIf you did not create an account, ignore this email.";

        $emailBody = nl2br(htmlspecialchars(str_replace('[user]', $username, $template)));
        $buttonHtml = '<a href="' . htmlspecialchars($verificationLink) . '" style="display:inline-block;padding:12px 30px;background:#2196F3;color:#fff;text-decoration:none;border-radius:5px;margin:20px 0">Verify Email</a>';
        $linkHtml = '<span style="word-break:break-all;color:#2196F3">' . htmlspecialchars($verificationLink) . '</span>';
        $emailBody = str_replace('[verify_link]', $buttonHtml . '<br><br>Or copy this link:<br>' . $linkHtml, $emailBody);

        $subject = "Verify Your Email - $appName";
        $message = "
        <html><body style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto'>
            <div style='background:#2196F3;color:#fff;padding:20px;text-align:center'>
                <h2>Verify Your Email</h2>
            </div>
            <div style='padding:20px;background:#f9f9f9'>$emailBody</div>
            <p style='text-align:center;color:#666;font-size:12px'>Skifflake Games — $appName</p>
        </body></html>";

        return self::send($userEmail, $subject, $message);
    }

    public static function sendPasswordResetEmail($userEmail, $username, $resetToken, $baseUrl = null) {
        $app = self::appConfig();
        $appName = $app['name'] ?? 'Tilezilla';

        if ($baseUrl === null) {
            $baseUrl = $app['base_url'] ?? 'http://localhost:8081';
        }

        $resetLink = rtrim($baseUrl, '/') . '/reset-password.html?token=' . urlencode($resetToken);
        $subject = "Password Reset - $appName";
        $message = "
        <html><body style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto'>
            <p>Hello " . htmlspecialchars($username) . ",</p>
            <p>Reset your $appName password:</p>
            <p><a href='" . htmlspecialchars($resetLink) . "' style='display:inline-block;padding:12px 30px;background:#FF9800;color:#fff;text-decoration:none;border-radius:5px'>Reset Password</a></p>
            <p style='word-break:break-all'>" . htmlspecialchars($resetLink) . "</p>
            <p><small>Link expires in 15 minutes. Ignore if you did not request this.</small></p>
        </body></html>";

        return self::send($userEmail, $subject, $message);
    }
}

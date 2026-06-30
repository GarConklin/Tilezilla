<?php
// Direct SMTP from auth container to mail.skifflakegames.com (separate VPS from Words Online).

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

    private static function envBool(string $key, bool $default): bool {
        $val = getenv($key);
        if ($val === false || $val === '') {
            return $default;
        }
        return in_array(strtolower((string) $val), ['1', 'true', 'yes', 'on'], true);
    }

    private static function smtpConfig(): array {
        $app = self::appConfig();
        $smtp = is_array($app['smtp'] ?? null) ? $app['smtp'] : [];

        $enabledDefault = array_key_exists('enabled', $smtp) ? (bool) $smtp['enabled'] : true;
        $tls = strtolower(trim((string) (getenv('SMTP_TLS') ?: ($smtp['tls'] ?? 'none'))));
        if (!in_array($tls, ['none', 'starttls', 'ssl'], true)) {
            $tls = 'none';
        }

        return [
            'enabled' => self::envBool('SMTP_ENABLED', $enabledDefault),
            'host' => getenv('SMTP_HOST') ?: ($smtp['host'] ?? 'mail.skifflakegames.com'),
            'port' => (int) (getenv('SMTP_PORT') ?: ($smtp['port'] ?? 587)),
            'tls' => $tls,
            'user' => getenv('SMTP_USER') ?: ($smtp['user'] ?? ''),
            'password' => getenv('SMTP_PASS') ?: ($smtp['password'] ?? ''),
            'timeout' => (int) (getenv('SMTP_TIMEOUT') ?: ($smtp['timeout'] ?? 30)),
        ];
    }

    private static function smtpRead($socket): string {
        $response = '';
        while (($line = fgets($socket, 515)) !== false) {
            $response .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        return $response;
    }

    private static function smtpCommand($socket, ?string $command, $expectCodes): string {
        if ($command !== null) {
            fwrite($socket, $command . "\r\n");
        }
        $response = self::smtpRead($socket);
        $code = (int) substr($response, 0, 3);
        $expected = array_map('intval', (array) $expectCodes);
        if (!in_array($code, $expected, true)) {
            throw new RuntimeException(
                'SMTP command failed'
                . ($command !== null ? " after [$command]" : '')
                . ': ' . trim($response)
            );
        }
        return $response;
    }

    private static function smtpDotStuff(string $body): string {
        $lines = preg_split("/\r\n|\n|\r/", $body);
        $out = [];
        foreach ($lines as $line) {
            if (isset($line[0]) && $line[0] === '.') {
                $line = '.' . $line;
            }
            $out[] = $line;
        }
        return implode("\r\n", $out);
    }

    private static function encodeHeaderValue(string $value): string {
        if (preg_match('/[^\x20-\x7E]/', $value)) {
            return '=?UTF-8?B?' . base64_encode($value) . '?=';
        }
        return $value;
    }

    private static function sendViaSmtp(
        string $to,
        string $subject,
        string $htmlBody,
        string $fromEmail,
        string $fromName
    ): bool {
        $smtp = self::smtpConfig();
        $host = $smtp['host'];
        $port = $smtp['port'];
        $timeout = max(5, $smtp['timeout']);
        $tls = $smtp['tls'];

        $scheme = $tls === 'ssl' ? 'ssl' : 'tcp';
        $errno = 0;
        $errstr = '';
        $socket = @stream_socket_client(
            "{$scheme}://{$host}:{$port}",
            $errno,
            $errstr,
            $timeout,
            STREAM_CLIENT_CONNECT
        );
        if (!$socket) {
            throw new RuntimeException("SMTP connect failed to {$host}:{$port} — $errstr ($errno)");
        }

        stream_set_timeout($socket, $timeout);

        try {
            self::smtpCommand($socket, null, [220]);

            $ehloHost = preg_replace('/[^a-zA-Z0-9.-]/', '', php_uname('n')) ?: 'tilezilla';
            self::smtpCommand($socket, "EHLO {$ehloHost}", [250]);

            if ($tls === 'starttls') {
                self::smtpCommand($socket, 'STARTTLS', [220]);
                if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                    throw new RuntimeException('SMTP STARTTLS negotiation failed');
                }
                self::smtpCommand($socket, "EHLO {$ehloHost}", [250]);
            }

            $user = trim((string) $smtp['user']);
            $password = (string) $smtp['password'];
            if ($user !== '') {
                self::smtpCommand($socket, 'AUTH LOGIN', [334]);
                self::smtpCommand($socket, base64_encode($user), [334]);
                self::smtpCommand($socket, base64_encode($password), [235]);
            }

            self::smtpCommand($socket, "MAIL FROM:<{$fromEmail}>", [250]);
            self::smtpCommand($socket, "RCPT TO:<{$to}>", [250, 251]);
            self::smtpCommand($socket, 'DATA', [354]);

            $encodedSubject = self::encodeHeaderValue($subject);
            $encodedFromName = self::encodeHeaderValue($fromName);
            $messageId = sprintf('<%s@%s>', bin2hex(random_bytes(8)), $ehloHost);
            $date = date('r');

            $headers = [
                "Date: {$date}",
                "From: {$encodedFromName} <{$fromEmail}>",
                "To: <{$to}>",
                "Subject: {$encodedSubject}",
                "Message-ID: {$messageId}",
                "MIME-Version: 1.0",
                "Content-Type: text/html; charset=UTF-8",
                "Content-Transfer-Encoding: 8bit",
                "X-Mailer: Tilezilla-PHP/" . phpversion(),
            ];

            $payload = implode("\r\n", $headers) . "\r\n\r\n" . $htmlBody;
            fwrite($socket, self::smtpDotStuff($payload) . "\r\n.\r\n");
            self::smtpCommand($socket, null, [250]);
            self::smtpCommand($socket, 'QUIT', [221]);
        } finally {
            fclose($socket);
        }

        return true;
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
        if (!filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) {
            error_log("EmailNotifier: Invalid from email: $fromEmail");
            return false;
        }

        $smtp = self::smtpConfig();
        if (!$smtp['enabled']) {
            error_log('EmailNotifier: SMTP_ENABLED is false — email not sent');
            return false;
        }

        try {
            return self::sendViaSmtp($to, $subject, $message, $fromEmail, $fromName);
        } catch (Throwable $e) {
            error_log('EmailNotifier: ' . $e->getMessage());
            return false;
        }
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

        $verificationLink = rtrim($baseUrl, '/') . '/auth/verify-email.html?token=' . urlencode($verificationToken);
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
            $baseUrl = $app['base_url'] ?? null;
        }
        if ($baseUrl === null) {
            $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
            $baseUrl = $protocol . '://' . $host;
        }

        $resetLink = rtrim($baseUrl, '/') . '/auth/reset-password.html?token=' . urlencode($resetToken);
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

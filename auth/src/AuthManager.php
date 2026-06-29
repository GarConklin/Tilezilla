<?php
// Shared with Words Online — uses WordsOnline.users table.

class AuthManager {
    private $conn;

    public function __construct($conn) {
        $this->conn = $conn;
    }

    public function register($username, $email, $password) {
        $this->validateUsername($username);
        $this->validateEmail($email);
        $this->validatePassword($password);

        if ($this->usernameExists($username)) {
            throw new Exception("Username already exists");
        }

        if ($this->emailExists($email)) {
            throw new Exception("Email already registered");
        }

        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        $verificationToken = bin2hex(random_bytes(32));

        $stmt = $this->conn->prepare(
            "INSERT INTO users (username, email, password_hash, verification_token, email_verified, paid, status)
             VALUES (?, ?, ?, ?, FALSE, 0, 'registered')"
        );

        if (!$stmt) {
            throw new Exception("Failed to prepare statement: " . $this->conn->error);
        }

        $stmt->bind_param("ssss", $username, $email, $passwordHash, $verificationToken);

        if (!$stmt->execute()) {
            throw new Exception("Failed to create account: " . $stmt->error);
        }

        $userId = $this->conn->insert_id;
        $stmt->close();

        return ['user_id' => $userId, 'verification_token' => $verificationToken];
    }

    public function login($username, $password) {
        $stmt = $this->conn->prepare(
            "SELECT id, username, email, password_hash, paid, status, is_admin, active_until, email_verified
             FROM users WHERE username = ?"
        );

        if (!$stmt) {
            throw new Exception("Database error");
        }

        $stmt->bind_param("s", $username);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 0) {
            throw new Exception("Invalid username or password");
        }

        $user = $result->fetch_assoc();
        $stmt->close();

        if (!password_verify($password, $user['password_hash'])) {
            throw new Exception("Invalid username or password");
        }

        if ($user['status'] === 'suspended') {
            throw new Exception("Account is suspended");
        }

        if ($user['status'] === 'expired') {
            throw new Exception("Your account has expired. Please renew to continue playing.");
        }

        $emailVerified = isset($user['email_verified']) ? (bool)$user['email_verified'] : false;
        if (!$emailVerified) {
            throw new Exception("Please verify your email address before logging in. Check your inbox for the verification email.");
        }

        if ($user['status'] === 'registered') {
            throw new Exception("Account is not yet activated. Please contact support.");
        }

        if (isset($user['active_until']) && $user['active_until'] !== null) {
            $activeUntil = new DateTime($user['active_until']);
            if ($activeUntil < new DateTime()) {
                throw new Exception("Your subscription expired on " . $activeUntil->format('Y-m-d') . ". Please renew to continue playing.");
            }
        }

        $this->updateLastLogin($user['id']);
        unset($user['password_hash']);
        return $user;
    }

    private function usernameExists($username) {
        $stmt = $this->conn->prepare("SELECT id FROM users WHERE username = ?");
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $exists = $stmt->get_result()->num_rows > 0;
        $stmt->close();
        return $exists;
    }

    private function emailExists($email) {
        $stmt = $this->conn->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $exists = $stmt->get_result()->num_rows > 0;
        $stmt->close();
        return $exists;
    }

    private function validateUsername($username) {
        if (empty($username)) throw new Exception("Username is required");
        if (strlen($username) < 3) throw new Exception("Username must be at least 3 characters");
        if (strlen($username) > 30) throw new Exception("Username must be 30 characters or less");
        if (!preg_match('/^[a-zA-Z0-9_-]+$/', $username)) {
            throw new Exception("Username can only contain letters, numbers, hyphens, and underscores");
        }
    }

    private function validateEmail($email) {
        if (empty($email)) throw new Exception("Email is required");
        if (strlen($email) > 45) throw new Exception("Email must be 45 characters or less");
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) throw new Exception("Invalid email format");
        if (!preg_match('/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/', $email)) {
            throw new Exception("Email contains invalid characters");
        }
    }

    private function validatePassword($password) {
        if (empty($password)) throw new Exception("Password is required");
        if (strlen($password) < 6) throw new Exception("Password must be at least 6 characters");
    }

    private function updateLastLogin($userId) {
        $stmt = $this->conn->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $stmt->close();
    }

    public function getUserById($userId) {
        $stmt = $this->conn->prepare(
            "SELECT id, username, email, paid, status, is_admin, created_at, last_login, active_until, email_verified,
                    guest_code
             FROM users WHERE id = ?"
        );
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($result->num_rows === 0) {
            $stmt->close();
            return null;
        }
        $user = $result->fetch_assoc();
        $stmt->close();
        $user['player_name'] = $user['username'];
        return $user;
    }

    public function verifySession() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        if (!isset($_SESSION['user_id'])) {
            return null;
        }
        $user = $this->getUserById($_SESSION['user_id']);
        if (!$user) return null;
        if (isset($user['status']) && in_array($user['status'], ['suspended', 'expired', 'registered'], true)) {
            return null;
        }
        if (empty($user['email_verified'])) return null;
        if (isset($user['active_until']) && $user['active_until'] !== null) {
            if (new DateTime($user['active_until']) < new DateTime()) return null;
        }
        return $user;
    }

    public function createSession($user) {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['email'] = $user['email'];
        $_SESSION['paid'] = (bool)$user['paid'];
        $_SESSION['is_admin'] = (bool)($user['is_admin'] ?? false);
    }
}

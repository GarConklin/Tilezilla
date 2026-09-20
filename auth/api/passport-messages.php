<?php
/**
 * Player passport messages — unread active notices + mark-as-read.
 */
header('Content-Type: application/json');
session_start();

require_once __DIR__ . '/../src/Db.php';
require_once __DIR__ . '/../src/AuthManager.php';
$config = require __DIR__ . '/../config/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $conn = Db::connect($config);
    $authManager = new AuthManager($conn);
    $user = $authManager->verifySession();
    if (!$user) {
        $conn->close();
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Not authenticated']);
        exit;
    }

    $userId = (int) $user['id'];

    if ($method === 'GET') {
        $unreadOnly = !isset($_GET['all']) || $_GET['all'] === '0' || $_GET['all'] === 'false';
        if ($unreadOnly) {
            $sql = 'SELECT m.id, m.title, m.body, m.created_at
                    FROM passport_messages m
                    LEFT JOIN passport_message_reads r
                      ON r.message_id = m.id AND r.user_id = ?
                    WHERE m.active = 1 AND r.user_id IS NULL
                    ORDER BY m.id ASC';
        } else {
            $sql = 'SELECT m.id, m.title, m.body, m.created_at,
                           (r.user_id IS NOT NULL) AS is_read, r.read_at
                    FROM passport_messages m
                    LEFT JOIN passport_message_reads r
                      ON r.message_id = m.id AND r.user_id = ?
                    WHERE m.active = 1
                    ORDER BY m.id ASC';
        }
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new Exception('Database error');
        }
        $stmt->bind_param('i', $userId);
        $stmt->execute();
        $result = $stmt->get_result();
        $messages = [];
        while ($row = $result->fetch_assoc()) {
            $item = [
                'id' => (int) $row['id'],
                'title' => $row['title'],
                'body' => $row['body'],
                'created_at' => $row['created_at'],
            ];
            if (!$unreadOnly) {
                $item['is_read'] = (bool) ($row['is_read'] ?? false);
                $item['read_at'] = $row['read_at'] ?? null;
            }
            $messages[] = $item;
        }
        $stmt->close();
        $conn->close();
        echo json_encode(['success' => true, 'messages' => $messages]);
        exit;
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!is_array($input)) {
            throw new Exception('Invalid JSON body');
        }
        $messageId = (int) ($input['message_id'] ?? $input['id'] ?? 0);
        if ($messageId < 1) {
            throw new Exception('message_id required');
        }

        $check = $conn->prepare('SELECT id FROM passport_messages WHERE id = ? AND active = 1 LIMIT 1');
        if (!$check) {
            throw new Exception('Database error');
        }
        $check->bind_param('i', $messageId);
        $check->execute();
        $exists = $check->get_result()->fetch_assoc();
        $check->close();
        if (!$exists) {
            $conn->close();
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Message not found']);
            exit;
        }

        $stmt = $conn->prepare(
            'INSERT IGNORE INTO passport_message_reads (user_id, message_id, read_at)
             VALUES (?, ?, NOW())'
        );
        if (!$stmt) {
            throw new Exception('Database error');
        }
        $stmt->bind_param('ii', $userId, $messageId);
        $stmt->execute();
        $stmt->close();
        $conn->close();
        echo json_encode(['success' => true, 'message_id' => $messageId, 'read' => true]);
        exit;
    }

    $conn->close();
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
} catch (Exception $e) {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
    error_log('passport-messages: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

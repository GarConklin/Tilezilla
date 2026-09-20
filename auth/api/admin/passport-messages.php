<?php
/**
 * Admin CRUD for passport messages shown in the player passport.
 */
header('Content-Type: application/json');

require_once __DIR__ . '/../../src/AdminGuard.php';
$config = require __DIR__ . '/../../config/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $ctx = AdminGuard::requireAdmin($config);
    $conn = $ctx['conn'];
    $adminId = $ctx['admin_id'];

    if ($method === 'GET') {
        $sql = 'SELECT m.id, m.title, m.body, m.active, m.created_by, m.created_at, m.updated_at,
                       (SELECT COUNT(*) FROM passport_message_reads r WHERE r.message_id = m.id) AS read_count
                FROM passport_messages m
                ORDER BY m.id DESC';
        $result = $conn->query($sql);
        if (!$result) {
            throw new Exception('Database error');
        }
        $messages = [];
        while ($row = $result->fetch_assoc()) {
            $messages[] = [
                'id' => (int) $row['id'],
                'title' => $row['title'],
                'body' => $row['body'],
                'active' => (bool) (int) $row['active'],
                'created_by' => $row['created_by'] !== null ? (int) $row['created_by'] : null,
                'created_at' => $row['created_at'],
                'updated_at' => $row['updated_at'],
                'read_count' => (int) $row['read_count'],
            ];
        }
        $conn->close();
        echo json_encode(['success' => true, 'messages' => $messages]);
        exit;
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!is_array($input)) {
            throw new Exception('Invalid JSON body');
        }
        $title = trim((string) ($input['title'] ?? ''));
        $body = trim((string) ($input['body'] ?? ''));
        $active = isset($input['active']) ? ((int) !!$input['active']) : 1;
        if ($title === '' || $body === '') {
            throw new Exception('title and body required');
        }
        if (strlen($title) > 200) {
            throw new Exception('title too long');
        }

        $stmt = $conn->prepare(
            'INSERT INTO passport_messages (title, body, active, created_by)
             VALUES (?, ?, ?, ?)'
        );
        if (!$stmt) {
            throw new Exception('Database error');
        }
        $stmt->bind_param('ssii', $title, $body, $active, $adminId);
        $stmt->execute();
        $id = (int) $stmt->insert_id;
        $stmt->close();
        $conn->close();
        echo json_encode([
            'success' => true,
            'message' => [
                'id' => $id,
                'title' => $title,
                'body' => $body,
                'active' => (bool) $active,
                'created_by' => $adminId,
                'read_count' => 0,
            ],
        ]);
        exit;
    }

    if ($method === 'PATCH') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!is_array($input)) {
            throw new Exception('Invalid JSON body');
        }
        $id = (int) ($input['id'] ?? 0);
        if ($id < 1) {
            throw new Exception('id required');
        }

        $fields = [];
        $types = '';
        $values = [];
        if (array_key_exists('title', $input)) {
            $title = trim((string) $input['title']);
            if ($title === '') {
                throw new Exception('title cannot be empty');
            }
            if (strlen($title) > 200) {
                throw new Exception('title too long');
            }
            $fields[] = 'title = ?';
            $types .= 's';
            $values[] = $title;
        }
        if (array_key_exists('body', $input)) {
            $body = trim((string) $input['body']);
            if ($body === '') {
                throw new Exception('body cannot be empty');
            }
            $fields[] = 'body = ?';
            $types .= 's';
            $values[] = $body;
        }
        if (array_key_exists('active', $input)) {
            $fields[] = 'active = ?';
            $types .= 'i';
            $values[] = (int) !!$input['active'];
        }
        if (!$fields) {
            throw new Exception('No fields to update');
        }

        $types .= 'i';
        $values[] = $id;
        $sql = 'UPDATE passport_messages SET ' . implode(', ', $fields) . ' WHERE id = ?';
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new Exception('Database error');
        }
        $stmt->bind_param($types, ...$values);
        $stmt->execute();
        if ($stmt->affected_rows < 0) {
            $stmt->close();
            $conn->close();
            throw new Exception('Update failed');
        }
        $stmt->close();

        $get = $conn->prepare(
            'SELECT id, title, body, active, created_by, created_at, updated_at,
                    (SELECT COUNT(*) FROM passport_message_reads r WHERE r.message_id = passport_messages.id) AS read_count
             FROM passport_messages WHERE id = ? LIMIT 1'
        );
        $get->bind_param('i', $id);
        $get->execute();
        $row = $get->get_result()->fetch_assoc();
        $get->close();
        $conn->close();
        if (!$row) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Message not found']);
            exit;
        }
        echo json_encode([
            'success' => true,
            'message' => [
                'id' => (int) $row['id'],
                'title' => $row['title'],
                'body' => $row['body'],
                'active' => (bool) (int) $row['active'],
                'created_by' => $row['created_by'] !== null ? (int) $row['created_by'] : null,
                'created_at' => $row['created_at'],
                'updated_at' => $row['updated_at'],
                'read_count' => (int) $row['read_count'],
            ],
        ]);
        exit;
    }

    if ($method === 'DELETE') {
        $id = (int) ($_GET['id'] ?? 0);
        if ($id < 1) {
            $body = json_decode(file_get_contents('php://input'), true);
            $id = (int) ($body['id'] ?? 0);
        }
        if ($id < 1) {
            throw new Exception('id required');
        }
        $stmt = $conn->prepare('DELETE FROM passport_messages WHERE id = ?');
        if (!$stmt) {
            throw new Exception('Database error');
        }
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $deleted = $stmt->affected_rows > 0;
        $stmt->close();
        $conn->close();
        if (!$deleted) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Message not found']);
            exit;
        }
        echo json_encode(['success' => true]);
        exit;
    }

    $conn->close();
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
} catch (Exception $e) {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
    error_log('admin passport-messages: ' . $e->getMessage());
    $code = str_contains($e->getMessage(), 'required') || str_contains($e->getMessage(), 'empty')
        || str_contains($e->getMessage(), 'too long') || str_contains($e->getMessage(), 'No fields')
        ? 400 : 500;
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

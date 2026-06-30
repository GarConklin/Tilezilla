<?php

class HintManager {
    private $conn;

    public function __construct($conn) {
        $this->conn = $conn;
    }

    public function getBalance(int $userId): int {
        $stmt = $this->conn->prepare('SELECT hint_tokens FROM users WHERE user_id = ? LIMIT 1');
        if (!$stmt) {
            throw new Exception('Database error');
        }
        $stmt->bind_param('i', $userId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$row) {
            throw new Exception('User not found');
        }
        return (int) ($row['hint_tokens'] ?? 0);
    }

    /**
     * @return array{hint_tokens: int, transaction_id: int}
     */
    public function applyTransaction(
        int $userId,
        int $amount,
        string $reason,
        ?string $referenceId = null
    ): array {
        if ($amount === 0) {
            throw new Exception('Amount must not be zero');
        }

        $reason = trim($reason);
        if ($reason === '') {
            throw new Exception('Reason is required');
        }
        if (strlen($reason) > 100) {
            $reason = substr($reason, 0, 100);
        }

        if ($referenceId !== null) {
            $referenceId = trim($referenceId);
            if ($referenceId === '') {
                $referenceId = null;
            } elseif (strlen($referenceId) > 50) {
                $referenceId = substr($referenceId, 0, 50);
            }
        }

        $this->conn->begin_transaction();
        try {
            $stmt = $this->conn->prepare(
                'SELECT hint_tokens FROM users WHERE user_id = ? LIMIT 1 FOR UPDATE'
            );
            $stmt->bind_param('i', $userId);
            $stmt->execute();
            $row = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if (!$row) {
                throw new Exception('User not found');
            }

            $balance = (int) ($row['hint_tokens'] ?? 0);
            if ($balance + $amount < 0) {
                throw new Exception('Not enough hint tokens');
            }

            $stmt = $this->conn->prepare(
                'UPDATE users SET hint_tokens = hint_tokens + ? WHERE user_id = ?'
            );
            $stmt->bind_param('ii', $amount, $userId);
            $stmt->execute();
            $stmt->close();

            $stmt = $this->conn->prepare(
                'UPDATE tile_profiles SET hint_tokens = hint_tokens + ? WHERE words_user_id = ?'
            );
            if ($stmt) {
                $stmt->bind_param('ii', $amount, $userId);
                $stmt->execute();
                $stmt->close();
            }

            $stmt = $this->conn->prepare(
                'INSERT INTO hint_transactions (user_id, amount, reason, reference_id)
                 VALUES (?, ?, ?, ?)'
            );
            $stmt->bind_param('iiss', $userId, $amount, $reason, $referenceId);
            $stmt->execute();
            $transactionId = (int) $stmt->insert_id;
            $stmt->close();

            $this->conn->commit();
        } catch (Exception $e) {
            $this->conn->rollback();
            throw $e;
        }

        return [
            'hint_tokens' => $balance + $amount,
            'transaction_id' => $transactionId,
        ];
    }
}

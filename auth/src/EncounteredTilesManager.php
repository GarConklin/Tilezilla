<?php
/**
 * Persist tile types a player has seen in puzzle bags (registered + guest).
 */

require_once __DIR__ . '/Db.php';
require_once __DIR__ . '/GuestManager.php';

class EncounteredTilesManager {
    private $gameConn;
    private $hasRegisteredTable = null;
    private $hasGuestTable = null;

    public function __construct(array $config) {
        $this->gameConn = Db::connect($config);
    }

    public function __destruct() {
        if ($this->gameConn instanceof mysqli) {
            $this->gameConn->close();
        }
    }

    public function listForUser($wordsUserId) {
        $userId = (int)$wordsUserId;
        if ($userId <= 0 || !$this->ensureRegisteredTable()) {
            return [];
        }

        $stmt = $this->gameConn->prepare(
            'SELECT tile_id FROM user_encountered_tiles WHERE words_user_id = ? ORDER BY tile_id'
        );
        if (!$stmt) {
            return [];
        }
        $stmt->bind_param('i', $userId);
        $stmt->execute();
        $result = $stmt->get_result();
        $tiles = [];
        while ($row = $result->fetch_assoc()) {
            $tiles[] = $row['tile_id'];
        }
        $stmt->close();
        return $tiles;
    }

    public function listForGuest($guestCode) {
        $code = GuestManager::normalizeGuestCode($guestCode);
        if (!$code || !$this->ensureGuestTable()) {
            return [];
        }

        $stmt = $this->gameConn->prepare(
            'SELECT tile_id FROM guest_encountered_tiles WHERE guest_code = ? ORDER BY tile_id'
        );
        if (!$stmt) {
            return [];
        }
        $stmt->bind_param('s', $code);
        $stmt->execute();
        $result = $stmt->get_result();
        $tiles = [];
        while ($row = $result->fetch_assoc()) {
            $tiles[] = $row['tile_id'];
        }
        $stmt->close();
        return $tiles;
    }

    /**
     * @return string[] newly recorded tile ids
     */
    public function recordForUser($wordsUserId, array $tileIds) {
        $userId = (int)$wordsUserId;
        $tileIds = $this->normalizeTileIds($tileIds);
        if ($userId <= 0 || !$tileIds || !$this->ensureRegisteredTable()) {
            return [];
        }

        $existing = array_flip($this->listForUser($userId));
        $newly = [];
        $stmt = $this->gameConn->prepare(
            'INSERT IGNORE INTO user_encountered_tiles (words_user_id, tile_id) VALUES (?, ?)'
        );
        if (!$stmt) {
            return [];
        }

        foreach ($tileIds as $tileId) {
            if (isset($existing[$tileId])) {
                continue;
            }
            $stmt->bind_param('is', $userId, $tileId);
            if ($stmt->execute() && $stmt->affected_rows > 0) {
                $newly[] = $tileId;
                $existing[$tileId] = true;
            }
        }
        $stmt->close();
        return $newly;
    }

    /**
     * @return string[] newly recorded tile ids
     */
    public function recordForGuest($guestCode, array $tileIds) {
        $code = GuestManager::normalizeGuestCode($guestCode);
        $tileIds = $this->normalizeTileIds($tileIds);
        if (!$code || !$tileIds || !$this->ensureGuestTable()) {
            return [];
        }

        $existing = array_flip($this->listForGuest($code));
        $newly = [];
        $stmt = $this->gameConn->prepare(
            'INSERT IGNORE INTO guest_encountered_tiles (guest_code, tile_id) VALUES (?, ?)'
        );
        if (!$stmt) {
            return [];
        }

        foreach ($tileIds as $tileId) {
            if (isset($existing[$tileId])) {
                continue;
            }
            $stmt->bind_param('ss', $code, $tileId);
            if ($stmt->execute() && $stmt->affected_rows > 0) {
                $newly[] = $tileId;
                $existing[$tileId] = true;
            }
        }
        $stmt->close();
        return $newly;
    }

    private function normalizeTileIds(array $tileIds) {
        $out = [];
        foreach ($tileIds as $id) {
            $id = strtoupper(trim((string)$id));
            if ($id === '' || !preg_match('/^[A-Z0-9_]{1,8}$/', $id)) {
                continue;
            }
            $out[$id] = true;
        }
        return array_keys($out);
    }

    private function ensureRegisteredTable() {
        if ($this->hasRegisteredTable !== null) {
            return $this->hasRegisteredTable;
        }
        if (!$this->gameConn instanceof mysqli) {
            $this->hasRegisteredTable = false;
            return false;
        }
        $result = $this->gameConn->query(
            "SELECT 1 FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_encountered_tiles' LIMIT 1"
        );
        $this->hasRegisteredTable = $result && $result->num_rows > 0;
        if ($result) {
            $result->free();
        }
        return $this->hasRegisteredTable;
    }

    private function ensureGuestTable() {
        if ($this->hasGuestTable !== null) {
            return $this->hasGuestTable;
        }
        if (!$this->gameConn instanceof mysqli) {
            $this->hasGuestTable = false;
            return false;
        }
        $result = $this->gameConn->query(
            "SELECT 1 FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_encountered_tiles' LIMIT 1"
        );
        $this->hasGuestTable = $result && $result->num_rows > 0;
        if ($result) {
            $result->free();
        }
        return $this->hasGuestTable;
    }
}

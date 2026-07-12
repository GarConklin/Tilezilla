-- One-time merge: WordsOnline.users -> tilegame.users (preserves numeric user ids).
-- Safe to re-run (ON DUPLICATE KEY UPDATE).
--
-- Run:
--   Get-Content scripts\migrate-auth-to-tilegame.sql -Raw |
--     docker compose exec -T mysql mysql -uroot -p

USE tilegame;

-- Ensure auth columns exist (upgrade path without full container re-init).
-- Applied automatically on new installs via 16-tilegame-auth-users.sql.

DROP PROCEDURE IF EXISTS tilegame_migrate_words_online_users;

DELIMITER //
CREATE PROCEDURE tilegame_migrate_words_online_users()
BEGIN
    DECLARE words_db_exists INT DEFAULT 0;

    SELECT COUNT(*) INTO words_db_exists
    FROM information_schema.SCHEMATA
    WHERE SCHEMA_NAME = 'WordsOnline';

    IF words_db_exists = 0 THEN
        SELECT 'WordsOnline database not found — skipping account merge' AS migration_note;
    ELSE
        INSERT INTO tilegame.users (
            user_id,
            username,
            player_name,
            email,
            password_hash,
            verification_token,
            email_verified,
            paid,
            status,
            is_admin,
            active_until,
            guest_code,
            last_login,
            created_at,
            `rank`,
            hint_tokens,
            current_streak,
            best_streak
        )
        SELECT
            w.id,
            w.username,
            w.username,
            w.email,
            w.password_hash,
            w.verification_token,
            COALESCE(w.email_verified, FALSE),
            COALESCE(w.paid, 0),
            COALESCE(w.status, 'registered'),
            COALESCE(w.is_admin, 0),
            w.active_until,
            w.guest_code,
            w.last_login,
            COALESCE(w.created_at, NOW()),
            COALESCE(tp.`rank`, 'Connector'),
            COALESCE(tp.hint_tokens, 5),
            COALESCE(tp.current_streak, 0),
            COALESCE(tp.best_streak, 0)
        FROM WordsOnline.users w
        LEFT JOIN tilegame.tile_profiles tp ON tp.words_user_id = w.id
        ON DUPLICATE KEY UPDATE
            username = VALUES(username),
            player_name = VALUES(player_name),
            email = VALUES(email),
            password_hash = VALUES(password_hash),
            verification_token = VALUES(verification_token),
            email_verified = VALUES(email_verified),
            paid = VALUES(paid),
            status = VALUES(status),
            is_admin = VALUES(is_admin),
            active_until = VALUES(active_until),
            guest_code = COALESCE(VALUES(guest_code), tilegame.users.guest_code),
            last_login = VALUES(last_login),
            `rank` = COALESCE(tilegame.users.`rank`, VALUES(`rank`)),
            hint_tokens = GREATEST(tilegame.users.hint_tokens, VALUES(hint_tokens)),
            current_streak = GREATEST(tilegame.users.current_streak, VALUES(current_streak)),
            best_streak = GREATEST(tilegame.users.best_streak, VALUES(best_streak));

        SELECT CONCAT('Merged WordsOnline accounts into tilegame.users') AS migration_note;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = 'WordsOnline' AND TABLE_NAME = 'registration_settings'
    ) THEN
        INSERT INTO tilegame.registration_settings (setting_key, setting_value)
        SELECT setting_key, setting_value
        FROM WordsOnline.registration_settings
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
    END IF;

    UPDATE tilegame.guest_users gu
    INNER JOIN tilegame.users u
        ON u.guest_code COLLATE utf8mb4_unicode_ci = gu.guest_code COLLATE utf8mb4_unicode_ci
    SET gu.words_user_id = u.user_id
    WHERE gu.words_user_id IS NULL AND u.guest_code IS NOT NULL;

    UPDATE tilegame.guest_users gu
    INNER JOIN tilegame.users u ON u.user_id = gu.words_user_id
    SET u.guest_code = gu.guest_code
    WHERE (u.guest_code IS NULL OR u.guest_code = '')
      AND gu.guest_code IS NOT NULL;
END//
DELIMITER ;

CALL tilegame_migrate_words_online_users();
DROP PROCEDURE tilegame_migrate_words_online_users;

SELECT user_id, username, email, email_verified, status, guest_code
FROM tilegame.users
ORDER BY user_id;

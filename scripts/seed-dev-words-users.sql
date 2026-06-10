-- Dev auth accounts for WordsOnline (shared Skifflake login).
-- Login-ready: email_verified + status active + paid.
-- IDs 900001 / 900002 must match scripts/seed-dev-users.sql in tilegame.

USE WordsOnline;

SET @gar_hash = '$2y$10$pkUJycfoDi5j8f2exp5V2u7X4vXxX6/NbrSoRsVatkp/dhhkGsROG';
SET @arn_hash = '$2y$10$nwtUdak2Z0GlP0NtvKk0r.H7.EXmMyHTmRdC2iDA7l29Gs7QTkrEW';

INSERT INTO users (
    id, username, email, password_hash,
    email_verified, paid, status, is_admin, active_until
) VALUES
(
    900001, 'gar', 'gar-dev@tilezilla.local', @gar_hash,
    TRUE, TRUE, 'active', FALSE, DATE_ADD(CURDATE(), INTERVAL 10 YEAR)
),
(
    900002, 'Arn', 'arn-dev@tilezilla.local', @arn_hash,
    TRUE, TRUE, 'active', FALSE, DATE_ADD(CURDATE(), INTERVAL 10 YEAR)
)
ON DUPLICATE KEY UPDATE
    username = VALUES(username),
    email = VALUES(email),
    password_hash = VALUES(password_hash),
    email_verified = TRUE,
    paid = TRUE,
    status = 'active',
    active_until = DATE_ADD(CURDATE(), INTERVAL 10 YEAR);

SELECT id, username, email, email_verified, paid, status, active_until
FROM users
WHERE id IN (900001, 900002)
ORDER BY id;

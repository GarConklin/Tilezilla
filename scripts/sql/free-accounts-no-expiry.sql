-- Remove 7-day trial for all existing Tilezilla accounts (free play).
-- Safe to re-run. Sets active_until = NULL (no expiry) for every verified user.
--
-- On production:
--   cd /opt/tilezilla
--   docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
--     sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
--     < scripts/sql/free-accounts-no-expiry.sql

USE tilegame;

-- Anyone who completed signup (verified email) — remove trial end date.
UPDATE users
SET
    status = 'active',
    paid = 1,
    active_until = NULL
WHERE email_verified = 1;

-- Catch accounts stuck as registered/expired but already verified.
UPDATE users
SET
    status = 'active',
    paid = 1,
    active_until = NULL
WHERE email_verified = 1
  AND status IN ('registered', 'expired');

-- Legacy Words Online setting — unused while accounts are free.
UPDATE registration_settings
SET setting_value = '0'
WHERE setting_key = 'trial_period_days';

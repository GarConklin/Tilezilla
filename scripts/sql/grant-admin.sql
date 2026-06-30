-- Grant admin flag to a user (run once per admin account).
-- Example: mysql -u tilegame -p tilegame < scripts/sql/grant-admin.sql
-- Or set username in the UPDATE below.

UPDATE users SET is_admin = 1 WHERE username = 'gar' LIMIT 1;

SELECT user_id, username, email, is_admin FROM users WHERE is_admin = 1;

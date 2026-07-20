-- Full player found-solutions history (placements + timing).
-- Safe to re-run on existing databases.
-- Run: mysql -u ... tilegame < scripts/sql/user-found-solutions.sql

USE tilegame;

DROP PROCEDURE IF EXISTS tilegame_add_user_found_solutions;

DELIMITER //
CREATE PROCEDURE tilegame_add_user_found_solutions()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'user_found_solutions'
    ) THEN
        CREATE TABLE user_found_solutions (
            found_id BIGINT NOT NULL AUTO_INCREMENT,
            user_id BIGINT NOT NULL,
            level_id VARCHAR(32) NOT NULL,
            solution_index INT NULL,
            is_bonus TINYINT(1) NOT NULL DEFAULT 0,
            equiv_hash CHAR(64) NOT NULL,
            placements_json JSON NOT NULL,
            completion_time_seconds INT NOT NULL DEFAULT 0,
            hints_used_count INT NOT NULL DEFAULT 0,
            example_route_viewed TINYINT(1) NOT NULL DEFAULT 0,
            leaderboard_submitted TINYINT(1) NOT NULL DEFAULT 0,
            found_at DATETIME(3) NOT NULL,
            PRIMARY KEY (found_id),
            UNIQUE KEY uq_user_level_equiv (user_id, level_id, equiv_hash),
            KEY idx_user_level (user_id, level_id),
            CONSTRAINT fk_user_found_solutions_user
                FOREIGN KEY (user_id) REFERENCES users(user_id)
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'user_progress_meta'
    ) THEN
        CREATE TABLE user_progress_meta (
            user_id BIGINT NOT NULL,
            meta_json JSON NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id),
            CONSTRAINT fk_user_progress_meta_user
                FOREIGN KEY (user_id) REFERENCES users(user_id)
        );
    END IF;
END //
DELIMITER ;

CALL tilegame_add_user_found_solutions();
DROP PROCEDURE IF EXISTS tilegame_add_user_found_solutions;

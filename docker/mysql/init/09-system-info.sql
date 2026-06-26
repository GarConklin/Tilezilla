-- Application metadata shown in the hamburger menu (single-row config).
USE tilegame;

CREATE TABLE system_info (
    id TINYINT NOT NULL PRIMARY KEY DEFAULT 1,
    version VARCHAR(32) NOT NULL,
    last_updated DATE NOT NULL,
    creator VARCHAR(128) NOT NULL,
    creation_date VARCHAR(64) NOT NULL,
    product_name VARCHAR(128) NOT NULL DEFAULT 'Tilezilla',
    environment VARCHAR(32) NOT NULL DEFAULT 'production',
    extra_json JSON NULL,
    CONSTRAINT chk_system_info_singleton CHECK (id = 1)
);

INSERT INTO system_info (
    id,
    version,
    last_updated,
    creator,
    creation_date,
    product_name,
    environment,
    extra_json
) VALUES (
    1,
    '1.0.0',
    '2026-06-16',
    'Gar Conklin',
    'March 28, 2026',
    'Tilezilla',
    'production',
    JSON_OBJECT('logoutRedirectUrl', 'https://www.skifflakegames.com/')
);

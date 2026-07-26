-- Add public contact email used under VERSION on The Cartographer's Journal.
-- Safe to re-run.

USE tilegame;

UPDATE system_info
SET extra_json = JSON_SET(
  COALESCE(extra_json, JSON_OBJECT()),
  '$.contactEmail',
  'gar@hotmail.ca'
)
WHERE id = 1
  AND (
    extra_json IS NULL
    OR JSON_EXTRACT(extra_json, '$.contactEmail') IS NULL
    OR JSON_UNQUOTE(JSON_EXTRACT(extra_json, '$.contactEmail')) = ''
  );

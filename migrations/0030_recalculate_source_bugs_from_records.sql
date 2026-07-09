WITH record_counts AS (
  SELECT
    bug_id,
    COUNT(*)::int AS total_records
  FROM source_bug_records
  GROUP BY bug_id
)
UPDATE source_bugs AS b
SET
  status = CASE
    WHEN rc.total_records >= 5 THEN 'debugueado'
    WHEN rc.total_records >= 1 THEN 'debugueando'
    ELSE 'identificado'
  END,
  victory_count = LEAST(rc.total_records, 5),
  updated_at = NOW()
FROM record_counts AS rc
WHERE b.id = rc.bug_id;

UPDATE source_bugs AS b
SET
  status = 'identificado',
  victory_count = 0,
  updated_at = NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM source_bug_records AS r
  WHERE r.bug_id = b.id
);

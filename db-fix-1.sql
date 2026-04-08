-- DB Fix 1: Ensure no Node 1 has status other than mastered
UPDATE skills SET status = 'mastered', is_auto_complete = 1, title = ''
WHERE level_position = 1
AND (status != 'mastered' OR is_auto_complete != 1 OR (title IS NOT NULL AND title != ''));

SELECT COUNT(*) as fixed_count FROM skills WHERE level_position = 1 AND status != 'mastered';

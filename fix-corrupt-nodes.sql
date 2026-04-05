-- Fix corrupt nodes with empty titles at levelPosition > 1
-- These 181 nodes have empty title but should have a default title

UPDATE skills
SET title = CONCAT('Nodo ', level_position)
WHERE level_position > 1
  AND area_id IS NOT NULL
  AND (title = '' OR title IS NULL)
  AND is_auto_complete != 1
  AND status = 'locked';

-- Verify the fix
SELECT 
  area_id, 
  level, 
  level_position, 
  id, 
  title, 
  status,
  COUNT(*) OVER () as total_fixed
FROM skills
WHERE level_position > 1
  AND area_id IS NOT NULL
  AND title LIKE 'Nodo%'
  AND is_auto_complete != 1
ORDER BY area_id, level, level_position;

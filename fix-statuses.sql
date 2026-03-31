-- SQL Script to fix statuses in Neon Database
-- Recalculates all node statuses according to unlockedLevel

-- First, get a summary of what needs fixing
WITH area_unlocked AS (
  SELECT 
    a.id as area_id,
    a.name,
    a.unlockedLevel,
    s.id as skill_id,
    s.title,
    s.level,
    s.levelPosition,
    s.status
  FROM areas a
  LEFT JOIN skills s ON s.areaId = a.id
  WHERE s.id IS NOT NULL
),
new_status AS (
  SELECT
    skill_id,
    CASE
      -- Levels below unlocked: all should be mastered
      WHEN level < unlockedLevel THEN 'mastered'
      -- Current unlocked level: apply progression rules
      WHEN level = unlockedLevel THEN
        CASE
          WHEN levelPosition = 1 THEN 'mastered'
          -- First non-mastered becomes available
          WHEN status != 'mastered' AND 
               NOT EXISTS (
                 SELECT 1 FROM area_unlocked au2 
                 WHERE au2.area_id = area_unlocked.area_id 
                   AND au2.level = area_unlocked.level
                   AND au2.levelPosition < area_unlocked.levelPosition
                   AND au2.status = 'available'
               ) THEN 'available'
          ELSE 'locked'
        END
      -- Levels above unlocked: all should be locked
      ELSE 'locked'
    END as new_status
  FROM area_unlocked
)
UPDATE skills
SET status = new_status.new_status
FROM new_status
WHERE skills.id = new_status.skill_id
  AND skills.status != new_status.new_status;

-- Similarly for projects
WITH project_unlocked AS (
  SELECT 
    p.id as project_id,
    p.name,
    p.unlockedLevel,
    s.id as skill_id,
    s.title,
    s.level,
    s.levelPosition,
    s.status
  FROM projects p
  LEFT JOIN skills s ON s.projectId = p.id
  WHERE s.id IS NOT NULL
),
new_status AS (
  SELECT
    skill_id,
    CASE
      WHEN level < unlockedLevel THEN 'mastered'
      WHEN level = unlockedLevel THEN
        CASE
          WHEN levelPosition = 1 THEN 'mastered'
          WHEN status != 'mastered' AND 
               NOT EXISTS (
                 SELECT 1 FROM project_unlocked pu2 
                 WHERE pu2.project_id = project_unlocked.project_id 
                   AND pu2.level = project_unlocked.level
                   AND pu2.levelPosition < project_unlocked.levelPosition
                   AND pu2.status = 'available'
               ) THEN 'available'
          ELSE 'locked'
        END
      ELSE 'locked'
    END as new_status
  FROM project_unlocked
)
UPDATE skills
SET status = new_status.new_status
FROM new_status
WHERE skills.id = new_status.skill_id
  AND skills.status != new_status.new_status;

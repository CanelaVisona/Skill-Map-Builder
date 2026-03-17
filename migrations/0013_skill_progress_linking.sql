-- Migration to change habits.skill_id to skills.user_skills_progress.id
-- This links habits to skill progress (lectura, escritura, etc.) instead of skill tree nodes

-- Step 1: Add new column for skill_progress_id
ALTER TABLE habits ADD COLUMN IF NOT EXISTS skill_progress_id varchar;

-- Step 2: Add new foreign key constraint
ALTER TABLE habits ADD CONSTRAINT habits_skill_progress_id_user_skills_progress_id_fk
  FOREIGN KEY (skill_progress_id) REFERENCES user_skills_progress(id) ON DELETE SET NULL;


-- Migration to add subskill_id column to habits table
-- This links habits to specific subskills for targeted XP rewards

ALTER TABLE habits ADD COLUMN IF NOT EXISTS subskill_id varchar;

-- Add foreign key constraint for subskill_id
ALTER TABLE habits ADD CONSTRAINT habits_subskill_id_skills_id_fk
  FOREIGN KEY (subskill_id) REFERENCES skills(id) ON DELETE SET NULL;

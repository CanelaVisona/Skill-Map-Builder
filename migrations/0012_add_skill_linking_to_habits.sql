-- Add skillId column to habits table for XP reward linking
ALTER TABLE habits ADD COLUMN skill_id varchar REFERENCES skills(id) ON DELETE SET NULL;

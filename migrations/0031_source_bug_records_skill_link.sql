ALTER TABLE source_bug_records
ADD COLUMN IF NOT EXISTS skill_id varchar;

CREATE INDEX IF NOT EXISTS source_bug_records_skill_idx
ON source_bug_records (skill_id);

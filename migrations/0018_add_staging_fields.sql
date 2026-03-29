-- Add content staging fields for level management
-- Add isAutoComplete flag to skills table (marks Node 1 of auto-generated levels)
ALTER TABLE "skills" ADD COLUMN "is_auto_complete" integer DEFAULT 0;

-- Add endOfAreaLevel to areas table (marks when area ends, no more levels auto-generated)
ALTER TABLE "areas" ADD COLUMN "end_of_area_level" integer;

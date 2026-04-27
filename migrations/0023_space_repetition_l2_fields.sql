ALTER TABLE "space_repetition_practices" ADD COLUMN "level" integer DEFAULT 1;
ALTER TABLE "space_repetition_practices" ADD COLUMN "level1_completed_date" varchar;
ALTER TABLE "space_repetition_practices" ADD COLUMN "completed_intervals_l2" jsonb DEFAULT '[]'::jsonb;

-- Adds area and skill linking to space_repetition_practices, mirroring habits:
-- areaId (single, nullable FK) + skillIds (jsonb array, for XP rewards on interval registration).

ALTER TABLE "space_repetition_practices" ADD COLUMN IF NOT EXISTS "area_id" varchar;
ALTER TABLE "space_repetition_practices" ADD COLUMN IF NOT EXISTS "skill_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;

DO $$ BEGIN
 ALTER TABLE "space_repetition_practices" ADD CONSTRAINT "space_repetition_practices_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

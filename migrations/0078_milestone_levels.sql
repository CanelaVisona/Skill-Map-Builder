-- Cumbres: niveles marcados como fin de tramo (no terminan el área/quest, a diferencia de end_of_area_level).
ALTER TABLE "areas" ADD COLUMN IF NOT EXISTS "milestone_levels" jsonb DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "milestone_levels" jsonb DEFAULT '[]'::jsonb;

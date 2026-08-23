ALTER TABLE "node_errors" ALTER COLUMN "skill_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "node_errors" ADD COLUMN IF NOT EXISTS "area_id" varchar;
--> statement-breakpoint
ALTER TABLE "node_errors" ADD COLUMN IF NOT EXISTS "project_id" varchar;

ALTER TABLE "node_errors" ADD COLUMN IF NOT EXISTS "skill_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "node_errors" ADD COLUMN IF NOT EXISTS "body_links" jsonb DEFAULT '[]'::jsonb NOT NULL;

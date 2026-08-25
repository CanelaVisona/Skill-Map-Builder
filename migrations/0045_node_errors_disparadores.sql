ALTER TABLE "node_errors" ADD COLUMN IF NOT EXISTS "disparadores" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "node_error_records" ADD COLUMN IF NOT EXISTS "disparador" text;

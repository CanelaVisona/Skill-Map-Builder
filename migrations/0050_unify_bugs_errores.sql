-- Unificar "bugs" y "errores": source_bug_records.senal -> disparador, y link node_errors.bug_id.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'source_bug_records' AND column_name = 'senal'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'source_bug_records' AND column_name = 'disparador'
  ) THEN
    ALTER TABLE "source_bug_records" RENAME COLUMN "senal" TO "disparador";
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "source_bug_records" ADD COLUMN IF NOT EXISTS "disparador" text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE "source_bug_records" ALTER COLUMN "disparador" SET DEFAULT '';
--> statement-breakpoint
ALTER TABLE "source_bug_records" ALTER COLUMN "estrategia" SET DEFAULT '';
--> statement-breakpoint
ALTER TABLE "source_bug_records" ADD COLUMN IF NOT EXISTS "node_error_record_id" varchar;
--> statement-breakpoint
ALTER TABLE "node_errors" ADD COLUMN IF NOT EXISTS "bug_id" varchar;

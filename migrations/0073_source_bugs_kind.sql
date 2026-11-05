-- Aciertos: misma tabla que los errores (source_bugs), con kind = 'acierto'. Lo existente queda
-- como 'error'.
ALTER TABLE "source_bugs" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'error' NOT NULL;

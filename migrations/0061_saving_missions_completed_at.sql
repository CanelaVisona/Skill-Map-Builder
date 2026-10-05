-- Fecha en que se cumplió cada misión: la tarjeta muestra solo las del mes en curso y el calendario agrupa las de meses anteriores.
ALTER TABLE "saving_missions" ADD COLUMN IF NOT EXISTS "completed_at" timestamp;
--> statement-breakpoint
-- Las misiones ya cumplidas antes de esta columna toman como fecha su última modificación.
UPDATE "saving_missions" SET "completed_at" = "updated_at" WHERE "done" = true AND "completed_at" IS NULL;

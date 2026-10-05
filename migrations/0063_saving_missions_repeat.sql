-- Misiones repetibles: al cumplir una se crea otra igual en la misma serie, y la racha cuenta las cumplidas de la serie.
ALTER TABLE "saving_missions" ADD COLUMN IF NOT EXISTS "repeatable" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "saving_missions" ADD COLUMN IF NOT EXISTS "series_id" varchar;

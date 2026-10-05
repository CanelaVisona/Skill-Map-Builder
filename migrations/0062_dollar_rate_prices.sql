-- Varios precios anotados por mes; "rate" pasa a ser su promedio.
ALTER TABLE "dollar_rates" ADD COLUMN IF NOT EXISTS "prices" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
-- Los meses cargados antes de esta columna arrancan con su único precio.
UPDATE "dollar_rates" SET "prices" = jsonb_build_array("rate") WHERE "prices" = '[]'::jsonb;

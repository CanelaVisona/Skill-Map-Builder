-- Etiqueta de cada estrategia del Journal ("para-intentar" | "util" | "no-util") y cuántas veces
-- se usó en una victoria sobre un error o en un acierto (el conteo que la "refuerza").
ALTER TABLE "journal_strategies" ADD COLUMN IF NOT EXISTS "label" text DEFAULT 'para-intentar' NOT NULL;
ALTER TABLE "journal_strategies" ADD COLUMN IF NOT EXISTS "use_count" integer DEFAULT 0 NOT NULL;

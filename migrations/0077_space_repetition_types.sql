-- Repetición espaciada: proyecto al que pertenece (para agrupar por proyecto), tipo de
-- repetición ("practice" | "concept") y, para "Repetición de conceptos", el punteo de pistas
-- y las respuestas escritas en cada intervalo confirmado.
ALTER TABLE "space_repetition_practices" ADD COLUMN IF NOT EXISTS "project_id" varchar REFERENCES "projects"("id") ON DELETE SET NULL;
ALTER TABLE "space_repetition_practices" ADD COLUMN IF NOT EXISTS "repetition_type" text DEFAULT 'practice' NOT NULL;
ALTER TABLE "space_repetition_practices" ADD COLUMN IF NOT EXISTS "concept_hints" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "space_repetition_practices" ADD COLUMN IF NOT EXISTS "concept_answers" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "space_repetition_practices" ADD COLUMN IF NOT EXISTS "context_description" text DEFAULT '' NOT NULL;
ALTER TABLE "space_repetition_practices" ADD COLUMN IF NOT EXISTS "target_levels" integer;

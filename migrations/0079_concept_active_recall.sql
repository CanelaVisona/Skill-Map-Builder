-- Repetición de conceptos: capa de recuperación activa (CÓMO repasar; el CUÁNDO lo siguen
-- decidiendo los intervalos). Puntos con pistas (título, palabras clave, pregunta disparadora,
-- imagen), respuesta completa y estado adaptativo con el historial de sesiones.
-- No modifica columnas existentes: los conceptos viejos derivan sus puntos de concept_hints.
ALTER TABLE "space_repetition_practices" ADD COLUMN IF NOT EXISTS "concept_points" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "space_repetition_practices" ADD COLUMN IF NOT EXISTS "concept_model_answer" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "space_repetition_practices" ADD COLUMN IF NOT EXISTS "concept_learning" jsonb;

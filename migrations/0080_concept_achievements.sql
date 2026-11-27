-- Repetición de conceptos: logros registrados en tiempo real mientras se responde. Es una capa
-- independiente de concept_learning (no modifica dominio ni indicadores).
ALTER TABLE "space_repetition_practices" ADD COLUMN IF NOT EXISTS "concept_achievements" jsonb DEFAULT '[]'::jsonb NOT NULL;

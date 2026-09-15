-- Sección "Meta final" entre Problemas y Preguntas: qué se busca realmente detrás del problema
-- (experiencias, crecimiento o contribución). Un texto libre por problema.
ALTER TABLE "question_problems" ADD COLUMN IF NOT EXISTS "goal" text DEFAULT '' NOT NULL;

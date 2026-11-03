-- Pregunta del Journal pasada a nodo Reflexión: mientras el nodo no se complete, la pregunta
-- no se muestra en el Journal; al completarse vuelve al final, con los registros del nodo.
ALTER TABLE "journal_questions" ADD COLUMN IF NOT EXISTS "reflection_skill_id" varchar;

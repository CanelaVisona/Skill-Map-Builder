-- Pregunta del Journal asignada a mano a un área/quest (mantener apretado su título). Si tiene
-- una, manda sobre el área/quest que sale de su nodo de origen.
ALTER TABLE "journal_questions" ADD COLUMN IF NOT EXISTS "area_id" varchar;
ALTER TABLE "journal_questions" ADD COLUMN IF NOT EXISTS "project_id" varchar;

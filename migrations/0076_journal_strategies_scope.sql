-- Estrategia del Journal asignada a mano a un área/quest (al editarla). Si tiene una, manda
-- sobre la que sale de su nodo de origen (igual que journal_questions, ver 0072).
ALTER TABLE "journal_strategies" ADD COLUMN IF NOT EXISTS "area_id" varchar;
ALTER TABLE "journal_strategies" ADD COLUMN IF NOT EXISTS "project_id" varchar;

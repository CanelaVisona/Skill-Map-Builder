-- Permite elegir más de una franja horaria por defecto para un hábito (antes era una sola).
-- Convierte default_time_slot (texto, nullable) en default_time_slots (jsonb, array).
ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "default_time_slots" jsonb NOT NULL DEFAULT '[]';

UPDATE "habits"
SET "default_time_slots" = jsonb_build_array("default_time_slot")
WHERE "default_time_slot" IS NOT NULL;

ALTER TABLE "habits" DROP COLUMN IF EXISTS "default_time_slot";

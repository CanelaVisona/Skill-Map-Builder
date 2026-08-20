-- Minutos mínimos sugeridos para un hábito o una práctica de repetición espaciada. Opcional
-- (nullable), se carga desde el formulario de alta/edición y se muestra junto a la tarea en
-- "Tareas de hoy", igual que ya pasa con plannedDuration para los nodos del árbol de skills.
ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "min_minutes" integer;
ALTER TABLE "space_repetition_practices" ADD COLUMN IF NOT EXISTS "min_minutes" integer;

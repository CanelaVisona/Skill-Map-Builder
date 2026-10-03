-- Nodos SideQuest: no forman parte del título del nivel, pero se hicieron en ese momento y hicieron crecer el área.
ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "is_side_quest" integer DEFAULT 0;

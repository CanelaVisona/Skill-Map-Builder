-- Libros y prácticas de repetición espaciada unidos a un área o quest: cada avance crea un nodo SideQuest confirmado ahí.
ALTER TABLE "books_library" ADD COLUMN IF NOT EXISTS "side_quest_area_id" varchar REFERENCES "areas"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "books_library" ADD COLUMN IF NOT EXISTS "side_quest_project_id" varchar REFERENCES "projects"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "space_repetition_practices" ADD COLUMN IF NOT EXISTS "side_quest_area_id" varchar REFERENCES "areas"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "space_repetition_practices" ADD COLUMN IF NOT EXISTS "side_quest_project_id" varchar REFERENCES "projects"("id") ON DELETE SET NULL;

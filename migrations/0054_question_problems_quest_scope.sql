-- Permite que un "problema" de la sección Preguntas pertenezca a un quest (proyecto) además de
-- a un área: area_id pasa a ser opcional y se agrega project_id (también opcional).
ALTER TABLE "question_problems" ALTER COLUMN "area_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "question_problems" ADD COLUMN IF NOT EXISTS "project_id" varchar REFERENCES "projects"("id") ON DELETE cascade;

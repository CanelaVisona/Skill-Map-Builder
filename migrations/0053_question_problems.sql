-- Sección "?" (Preguntas), arriba del Book Tracker. Se divide por área.
-- question_problems: un "problema" por área, con foundAt para "Encontrados⚔️".
-- question_items: cadenas pregunta -> respuesta -> acción (una por eslabón).
CREATE TABLE IF NOT EXISTS "question_problems" (
  "id" varchar PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "area_id" varchar NOT NULL REFERENCES "areas"("id") ON DELETE cascade,
  "text" text DEFAULT '' NOT NULL,
  "found_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "question_items" (
  "id" varchar PRIMARY KEY NOT NULL,
  "problem_id" varchar NOT NULL REFERENCES "question_problems"("id") ON DELETE cascade,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "question" text DEFAULT '' NOT NULL,
  "answer" text DEFAULT '' NOT NULL,
  "action" text DEFAULT '' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "question_problems_user_id_idx" ON "question_problems" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "question_items_problem_id_idx" ON "question_items" ("problem_id");

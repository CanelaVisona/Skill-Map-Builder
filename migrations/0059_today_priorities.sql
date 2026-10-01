-- Prioridades del día (hasta 3 tareas "no negociables" de Tareas de hoy, con la estrellita).
CREATE TABLE IF NOT EXISTS "today_priorities" (
  "id" varchar PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "date" varchar NOT NULL,
  "task_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "source_bugs" (
  "id" varchar PRIMARY KEY NOT NULL,
  "user_id" varchar REFERENCES "users"("id") ON DELETE CASCADE,
  "area_id" varchar,
  "project_id" varchar,
  "nombre" text NOT NULL,
  "status" text NOT NULL DEFAULT 'activo',
  "desc" text NOT NULL DEFAULT '',
  "aparece" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "disparadores" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "estrategias" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "source_bug_records" (
  "id" varchar PRIMARY KEY NOT NULL,
  "bug_id" varchar NOT NULL REFERENCES "source_bugs"("id") ON DELETE CASCADE,
  "user_id" varchar REFERENCES "users"("id") ON DELETE CASCADE,
  "fecha" varchar NOT NULL,
  "situacion" text NOT NULL,
  "senal" text NOT NULL,
  "estrategia" text NOT NULL,
  "resultado" text NOT NULL DEFAULT 'empate',
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "source_bugs_user_area_idx" ON "source_bugs" ("user_id", "area_id");
CREATE INDEX IF NOT EXISTS "source_bugs_user_project_idx" ON "source_bugs" ("user_id", "project_id");
CREATE INDEX IF NOT EXISTS "source_bug_records_bug_idx" ON "source_bug_records" ("bug_id");

-- Fuentes de ingreso para el gráfico "Ingresos" de Metas financieras: cada una es activa o
-- pasiva y guarda lo cobrado en 3 meses (el gráfico muestra el promedio).
CREATE TABLE IF NOT EXISTS "income_sources" (
  "id" varchar PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "kind" text DEFAULT 'activo' NOT NULL,
  "months" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

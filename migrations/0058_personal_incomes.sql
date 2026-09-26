-- Ingresos personales (sueldo, freelance, etc.) del modal de finanzas, separados de las metas.
CREATE TABLE IF NOT EXISTS "personal_incomes" (
  "id" varchar PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "source" text NOT NULL,
  "amount" double precision DEFAULT 0 NOT NULL,
  "date" varchar NOT NULL,
  "note" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Estrategias de ahorro planteadas como misiones tildables dentro del modal de finanzas.
CREATE TABLE IF NOT EXISTS "saving_missions" (
  "id" varchar PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "emoji" text DEFAULT '🎯' NOT NULL,
  "amount" double precision DEFAULT 0 NOT NULL,
  "done" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Por si la tabla ya existía sin el monto ahorrado.
ALTER TABLE "saving_missions" ADD COLUMN IF NOT EXISTS "amount" double precision DEFAULT 0 NOT NULL;

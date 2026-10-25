-- Tab "Conceptos" del perfil: misma estructura que "Sobre mí" (nombre + descripción).
CREATE TABLE IF NOT EXISTS "profile_concepts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar REFERENCES "users"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL
);

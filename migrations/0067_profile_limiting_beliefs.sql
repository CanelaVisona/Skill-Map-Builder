-- Tab "Creencias limitantes" del perfil: misma estructura que "Conceptos" (nombre + descripción).
CREATE TABLE IF NOT EXISTS "profile_limiting_beliefs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar REFERENCES "users"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL
);

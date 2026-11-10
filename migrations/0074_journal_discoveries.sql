-- "Descubrimientos" del Journal: misma estructura que journal_learnings (título + descripción, nodo
-- opcional). Se cargan desde el cubo "Nuevo descubrimiento" del modal de feedback post-confirmación.
CREATE TABLE IF NOT EXISTS "journal_discoveries" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar REFERENCES "users"("id") ON DELETE CASCADE,
	"skill_id" varchar,
	"title" text NOT NULL,
	"sentence" text DEFAULT '' NOT NULL
);

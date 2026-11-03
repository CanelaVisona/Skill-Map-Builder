-- Nodos Reflexión: funcionan como un nodo normal, pero se dibujan con el ícono de una nota en vez del punto.
ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "is_reflection" integer DEFAULT 0;
ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "reflection_prompt" text DEFAULT '';
ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "reflection_entries" jsonb DEFAULT '[]'::jsonb;

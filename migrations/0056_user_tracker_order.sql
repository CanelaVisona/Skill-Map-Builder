-- Orden manual del Progress Tracker por usuario, para que el tracker y el menú de áreas
-- muestren el mismo orden en todos los dispositivos (antes vivía en localStorage).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tracker_order" jsonb DEFAULT '[]'::jsonb NOT NULL;

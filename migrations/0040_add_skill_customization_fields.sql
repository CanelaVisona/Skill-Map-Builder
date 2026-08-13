-- Rediseño visual de los rombos/medallones de skill (Journal → Skills). Todas las columnas
-- son opcionales o tienen default, así los skills existentes siguen renderizando bien
-- ("rombo de hierro") sin necesitar backfill de datos.
ALTER TABLE global_skills ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE global_skills ADD COLUMN IF NOT EXISTS shape text NOT NULL DEFAULT 'diamond_classic';
ALTER TABLE global_skills ADD COLUMN IF NOT EXISTS material text NOT NULL DEFAULT 'iron';
ALTER TABLE global_skills ADD COLUMN IF NOT EXISTS rarity text NOT NULL DEFAULT 'common';
ALTER TABLE global_skills ADD COLUMN IF NOT EXISTS accent_color text;
ALTER TABLE global_skills ADD COLUMN IF NOT EXISTS glow integer;
ALTER TABLE global_skills ADD COLUMN IF NOT EXISTS node_size text NOT NULL DEFAULT 'normal';

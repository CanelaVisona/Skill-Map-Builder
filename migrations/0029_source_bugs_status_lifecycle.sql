ALTER TABLE "source_bugs"
  ALTER COLUMN "status" SET DEFAULT 'identificado';

UPDATE "source_bugs"
SET "status" = CASE
  WHEN "status" = 'activo' THEN 'identificado'
  WHEN "status" = 'neutralizado' THEN 'debugueando'
  WHEN "status" = 'desactivado' THEN 'debugueado'
  ELSE "status"
END;

UPDATE "source_bugs"
SET "victory_count" = 5
WHERE "status" = 'debugueado' AND "victory_count" < 5;

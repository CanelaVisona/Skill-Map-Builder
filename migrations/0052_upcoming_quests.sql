-- "Próximos": quests queued for later, hidden from the menu until activated.
-- Optional scheduled_unlock_at auto-activates the quest once that moment passes.
ALTER TABLE "areas" ADD COLUMN IF NOT EXISTS "upcoming" integer DEFAULT 0;
ALTER TABLE "areas" ADD COLUMN IF NOT EXISTS "scheduled_unlock_at" timestamp;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "upcoming" integer DEFAULT 0;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "scheduled_unlock_at" timestamp;

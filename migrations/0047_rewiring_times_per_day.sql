ALTER TABLE "rewiring_trackers" ADD COLUMN IF NOT EXISTS "times_per_day" integer;
ALTER TABLE "rewiring_tracker_records" ADD COLUMN IF NOT EXISTS "date" varchar;

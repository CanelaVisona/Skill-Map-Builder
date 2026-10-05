-- Hábitos que se repiten cada X días o una vez por mes, además de por días de la semana.
ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "repeat_mode" text DEFAULT 'weekly' NOT NULL;
--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "repeat_interval" integer;
--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "repeat_month_day" integer;
--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "repeat_start_date" varchar;

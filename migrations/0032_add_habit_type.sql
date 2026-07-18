-- Add habit_type column to habits table
-- Distinguishes "mini" habits (short, near-daily) from "deep" activities (longer, less frequent)
-- Default: "mini" so existing habits keep their current behavior

ALTER TABLE "habits" ADD COLUMN "habit_type" text NOT NULL DEFAULT 'mini';

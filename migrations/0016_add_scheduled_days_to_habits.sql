-- Add scheduled_days column to habits table
-- This stores which days of the week the habit should be tracked
-- JSON array of numbers 0-6 (0=Monday, 6=Sunday)
-- Default: all days [0,1,2,3,4,5,6]

ALTER TABLE "habits" ADD COLUMN "scheduled_days" jsonb DEFAULT '[0,1,2,3,4,5,6]';

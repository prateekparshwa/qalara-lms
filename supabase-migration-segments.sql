-- Qalara LMS v2 — add segments
-- Run once in Supabase → SQL Editor → New query → Run.

-- 1. Add the segment column (engagement / no_engagement / prospects / customers / discover)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS segment TEXT;

-- 2. Backfill existing rows: the current data is the Engagement segment.
UPDATE leads SET segment = 'engagement' WHERE segment IS NULL;

-- 3. Index for fast per-segment filtering.
CREATE INDEX IF NOT EXISTS leads_segment_idx ON leads(segment);

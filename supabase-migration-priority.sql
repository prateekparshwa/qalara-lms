-- Qalara LMS — priority_rank for HIGH→LOW default sorting
-- Run once in Supabase → SQL Editor → New query → Run.

-- 1. Numeric rank column (HIGH=3, MED=2, LOW=1, unset=0)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS priority_rank INT DEFAULT 0;

-- 2. Backfill from the existing buyer_classification text.
UPDATE leads SET priority_rank = CASE
  WHEN buyer_classification ILIKE '%HIGH%' THEN 3
  WHEN buyer_classification ILIKE '%MED%'  THEN 2
  WHEN buyer_classification ILIKE '%LOW%'  THEN 1
  ELSE 0
END;

-- 3. Index for fast priority sorting.
CREATE INDEX IF NOT EXISTS leads_priority_rank_idx ON leads(priority_rank);

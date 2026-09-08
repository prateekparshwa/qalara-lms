-- Qalara LMS — Enquiry History (from the Leads&Enqs Tracker's EnquiryTracker tab)
-- Run once in Supabase → SQL Editor → New query → Run.
--
-- Stores every enquiry row found for a buyer (matched by org name against
-- the tracker), as a JSON array sorted latest-first by Enquiry/Sample Date.
-- Shown as its own section in the buyer dossier. Structure per entry:
--   { "enquiryId": "ENQ0013", "description": "...", "enquiryDate": "2025-08-...",
--     "estimateClosure": "...", "actualClosureDispatch": "...",
--     "scheduledNextAction": "...", "revisedNextAction": "...", "orderId": "..." }

ALTER TABLE leads ADD COLUMN IF NOT EXISTS enquiry_history JSONB;

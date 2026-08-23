-- Qalara LMS — HubSpot pull-sync columns (Customers segment)
-- Run once in Supabase → SQL Editor → New query → Run.
-- Additive only: existing rows/columns are untouched until the first
-- HubSpot sync commits (see app/api/leads/hubspot-sync).

ALTER TABLE leads ADD COLUMN IF NOT EXISTS hubspot_contact_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS hubspot_company_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS hubspot_deal_stage TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS hubspot_last_activity_date TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS hubspot_notes_count INT;
-- 'matched' | 'not_found' | 'skipped' (no email/website to match on)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS hubspot_match_status TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS hubspot_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS leads_hubspot_match_status_idx ON leads(hubspot_match_status);

-- ============================================================
-- Part 2 — HubSpot email pull (overwrites last_email_subject /
-- email_contact_summary). Locked like current_am/am_locked so a later
-- Google Sheets sync can't silently clobber a HubSpot-pulled email.
-- Run once, after Part 1 above.
-- ============================================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS hubspot_email_locked BOOLEAN DEFAULT FALSE;

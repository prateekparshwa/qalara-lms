-- Qalara LMS — Email gist + full-text split
-- Run once in Supabase → SQL Editor → New query → Run.
--
-- email_contact_summary now holds a short LLM gist of the last email (3-4
-- lines + an action point). The raw email body moves to email_contact_full,
-- surfaced behind "Show full email" in the dossier alongside a HubSpot link.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_contact_full TEXT;

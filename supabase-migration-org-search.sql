-- Qalara LMS — space/punctuation-insensitive organization search
-- Run once in Supabase → SQL Editor → New query → Run.
--
-- Problem: org search matched with `organization ILIKE 'term%'` — a prefix
-- match on the raw string. A user searching "Asterblume" got "not found" for
-- a lead actually stored as "Aster Blume Living", because the extra space
-- breaks both the prefix match AND a plain substring match.
--
-- Fix: a generated column holding the org name lowercased with everything
-- but letters/digits stripped, so "Asterblume" and "Aster Blume Living" both
-- normalize to "asterblumeliving" and a substring search finds it either way.

-- 1. Generated column, kept in sync automatically by Postgres on every write.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS organization_normalized TEXT
  GENERATED ALWAYS AS (regexp_replace(lower(organization), '[^a-z0-9]+', '', 'g')) STORED;

-- 2. Index for fast substring search at this table's size.
CREATE INDEX IF NOT EXISTS leads_organization_normalized_idx ON leads (organization_normalized);

-- Qalara LMS — treat "&" as "and" in organization search
-- Run once in Supabase → SQL Editor → New query → Run.
--
-- Problem: organization_normalized (supabase-migration-org-search.sql) strips
-- "&" along with all other punctuation instead of expanding it — "Love & Rosie"
-- normalizes to "loverosie", but a search for "Love and Rosie" normalizes to
-- "loveandrosie". Neither side ever matches the other, so a real lead
-- ("Love & Rosie") was invisible to a perfectly reasonable search.
--
-- Fix: expand "&" to " and " BEFORE stripping punctuation, so both spellings
-- collapse to the same "loveandrosie". Postgres can't alter a generated
-- column's expression in place, so this drops and recreates it (and its
-- index) with the corrected definition — the column is derived data, so
-- nothing is lost.

ALTER TABLE leads DROP COLUMN IF EXISTS organization_normalized;

ALTER TABLE leads ADD COLUMN organization_normalized TEXT
  GENERATED ALWAYS AS (
    regexp_replace(regexp_replace(lower(organization), '&', ' and ', 'g'), '[^a-z0-9]+', '', 'g')
  ) STORED;

CREATE INDEX IF NOT EXISTS leads_organization_normalized_idx ON leads (organization_normalized);

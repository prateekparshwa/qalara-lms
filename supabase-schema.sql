-- ============================================================
-- Qalara LMS — Supabase Schema
-- Run this in the Supabase SQL editor before importing data
-- ============================================================

CREATE TABLE IF NOT EXISTS leads (
  id                    BIGSERIAL PRIMARY KEY,
  source                TEXT,
  organization          TEXT,
  full_name             TEXT,
  designation           TEXT,
  phone                 TEXT,
  email                 TEXT,
  website               TEXT,
  country               TEXT,
  address               TEXT,
  buyer_type            TEXT,
  categories            TEXT,
  employee_size         TEXT,
  org_scale             TEXT,
  brand_description     TEXT,
  materials_dealt       TEXT,
  customers_and_markets TEXT,
  revenue_turnover      TEXT,
  competitors           TEXT,
  target_audience       TEXT,
  store_count           TEXT,
  import_countries      TEXT,
  price_points          TEXT,
  imports_from_india    TEXT,
  linkedin_url          TEXT,
  linkedin_followers    TEXT,
  instagram_handle      TEXT,
  instagram_followers   TEXT,
  social_media_activity TEXT,
  first_contact_date    TEXT,
  last_contact_date     TEXT,
  email_snapshot        TEXT,
  current_am            TEXT,
  last_qalara_contact   TEXT,
  last_email_subject    TEXT,
  email_contact_summary TEXT,
  sourcing_emails_low   TEXT,
  sourcing_emails_mid   TEXT,
  sourcing_emails_high  TEXT,
  quotations_request    TEXT,
  samples_request       TEXT,
  buyers_emails_low     TEXT,
  buyers_emails_mid     TEXT,
  buyers_emails_high    TEXT,
  quotations            TEXT,
  samples               TEXT,
  buyer_classification  TEXT,
  full_name_original    TEXT,
  website_confidence    TEXT,
  raw_data              JSONB,
  imported_at           TIMESTAMPTZ DEFAULT NOW(),
  enriched_at           TIMESTAMPTZ,
  enrichment_cache      JSONB
);

-- Composite unique key for upserts
CREATE UNIQUE INDEX IF NOT EXISTS leads_org_email_idx
  ON leads (organization, email)
  WHERE organization IS NOT NULL AND email IS NOT NULL;

-- Full-text search index
CREATE INDEX IF NOT EXISTS leads_fts ON leads
  USING GIN(
    to_tsvector('english',
      coalesce(organization, '') || ' ' ||
      coalesce(email, '') || ' ' ||
      coalesce(website, '') || ' ' ||
      coalesce(full_name, '')
    )
  );

-- Filter indexes
CREATE INDEX IF NOT EXISTS leads_country_idx ON leads (country);
CREATE INDEX IF NOT EXISTS leads_buyer_type_idx ON leads (buyer_type);
CREATE INDEX IF NOT EXISTS leads_classification_idx ON leads (buyer_classification);
CREATE INDEX IF NOT EXISTS leads_am_idx ON leads (current_am);
CREATE INDEX IF NOT EXISTS leads_confidence_idx ON leads (website_confidence);

-- Enable Row Level Security (optional, since no auth in Phase 1)
-- ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Public read" ON leads FOR SELECT USING (true);

COMMENT ON TABLE leads IS 'Qalara HiPo buyer leads — 5086 rows, 52 columns from Leads_Final_COMPLETE_v8_cleaned.xlsx';

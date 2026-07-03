# Qalara LMS — Lead Management System

A buyer-intelligence dashboard for Qalara. It ingests buyers from Google Sheets,
enriches them from the web, and gives the sales team a fast way to search,
filter, assign, annotate, and research buyers.

**Production:** https://qalara-lms.vercel.app (behind Basic Auth)
**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres) · Vercel

---

## Table of contents
- [Architecture](#architecture)
- [Routes](#routes)
- [Data flow & Sync](#data-flow--sync)
- [Features](#features)
- [Web enrichment](#web-enrichment)
- [Access control](#access-control)
- [Environment variables](#environment-variables)
- [Database schema & migrations](#database-schema--migrations)
- [Local development](#local-development)
- [Deploying](#deploying)
- [Project layout](#project-layout)

---

## Architecture

```
Excel ──upload──▶ Google Sheet ──Sync──▶ Supabase ──▶ Dashboard / Dossier
                                            ▲
Web (TinyFish / Hunter / Apify /            │
     context.dev / Firecrawl / OpenRouter) ─┘  (Live Intelligence & Discovery)
```

- **Frontend + API**: Next.js App Router on Vercel. All data access runs
  server-side (API routes) using the Supabase **service-role** client; the
  browser never talks to Supabase directly.
- **Auth**: a single shared Basic-Auth login enforced in `middleware.ts`.
- **Two ways buyers enter the system**:
  - **Qalara Buyer Directory** — buyers you already track, synced from Google
    Sheets (which you populate from an Excel master).
  - **General Discovery** — research any new prospect from the web; results are
    auto-saved to the `discover` segment.

---

## Routes

| Route | Purpose |
|---|---|
| `/` | Landing lobby — Directory vs Discovery |
| `/directory` | Segment chooser (Engagement is live; others coming soon) |
| `/directory/[segment]` | The dashboard (daily workspace) |
| `/discover` | General Discovery web research |
| `/api/leads` | List/search/filter leads |
| `/api/leads/sync` | Sync a segment from its Google Sheet |
| `/api/leads/export` | CSV/XLSX export of the filtered set |
| `/api/leads/assign-am`, `/assign-am-bulk` | Assign / release / unassign AM |
| `/api/leads/notes` | Save AM notes |
| `/api/enrich/search`, `/scrape`, `/moodboard`, `/apify` | Live Intelligence |
| `/api/find-contact` | Decision-maker lookup (Hunter) |
| `/api/research` | General Discovery pipeline |

---

## Data flow & Sync

The Directory side is driven by **per-segment Google Sheets**:

1. Edit your **Excel master**, then upload/replace the **Google Sheet**.
2. Click **Sync** → `POST /api/leads/sync?segment=engagement`.
3. The server reads the whole sheet (`lib/google-sheets.ts`), maps each column
   to a DB field (`lib/sheet-schema.ts`), and runs **`replaceSegmentLeads`**
   (`lib/leads.ts`):
   - Records the current max row id (**watermark**), inserts the fresh rows,
     then deletes the old rows at/below the watermark. The segment is never
     empty mid-operation and a failed insert rolls back only that run.
   - **Preserve-on-sync**: dashboard-only fields absent from the sheet are
     carried over per buyer (matched by website, else org + email):
     `website_confidence`, `full_name_original`, and the **AM lock** + **AM
     notes** columns. This is why locked AMs and notes survive a re-upload.

> **Rule of thumb:** the Google Sheet is the source of truth *at sync time*; the
> database/UI is the source the rest of the time. Nothing syncs automatically —
> only the **Sync** button pulls sheet changes in.

---

## Features

### Dashboard (`/directory/engagement`)
- **Stats band** — totals, verified, high-confidence, high-potential, assigned.
- **Search** — Organization (prefix match), Email, Website, with a typeahead
  that opens the buyer's dossier directly.
- **Filters** — Purchase Potential, Account Manager, **Show Unassigned AM
  Leads**, Country, Business Type, Org Size, Sources-From-India. Each filter's
  colour dot **glows** while it is active.
- **Correct tier counts** — classification uses start-anchored matching
  (`lib/format.ts` `classificationTier`) so "higher" in a rationale sentence
  never inflates the HIGH count.
- **Bulk AM assign / unassign** (editor-gated) — select rows and assign an AM
  or unassign; one DB statement + one batched Google-Sheet write-back per
  segment. Assignments are **locked** so a sync won't revert them.
- **Export** — CSV/XLSX of exactly the current filtered set, paged in
  1,000-row chunks to beat Postgres's response cap.

### Buyer dossier (drawer)
- Header: org, country, badges, **Designation** (left of) **Account Manager**
  + AM lock/release, teal radar sweep + amber tint, Download PDF.
- Sections: Basics, Social, Buyer Purchase Potential, Brand Description,
  Engagement, **Engagement Metrics** (email-count buckets + quotation/sample
  keyword tooltips), **AM Notes**, Moodboard.
- **AM Notes** — a collapsible section, editable by any signed-in user, saved
  to the DB with author + timestamp, and preserved across syncs.
- **AM lock / release** — a dashboard AM change is locked; "Release to sheet"
  hands control back to the sheet on the next sync.

### AM lock model
- Assigning an AM (single or bulk) sets `am_locked = true`.
- On sync, a locked lead keeps its AM regardless of the sheet value.
- "Release to sheet" clears the lock so the next sync adopts the sheet's AM.

---

## Web enrichment

### Live Intelligence (dossier, on-demand, 7-day cache)
| Lookup | Provider |
|---|---|
| Find Decision-Maker | **Hunter** |
| Scrape Website | **TinyFish Fetch** (`api.fetch.tinyfish.ai`) |
| Web Search | **TinyFish Search** (`api.search.tinyfish.ai`) |
| Apify Lookup | **Apify** |

Results cache to `leads.enrichment_cache` with a 7-day TTL. TinyFish helpers
live in `lib/tinyfish.ts` (auth via the `X-API-Key` header).

### Brand Moodboard
- **Images / brand / typography** → **context.dev** (`lib/contextdev.ts`).
- **Site-content markdown** → **TinyFish Fetch**, falling back to **Firecrawl**
  when TinyFish returns nothing.
- **Editorial layer** (tagline, palette, voice, programs) → **OpenRouter**
  (Claude Haiku 4.5, DeepSeek fallback).
- **Screenshot fallback** → **Firecrawl** (when the image grid is thin).
- Cached in `enrichment_cache.moodboard` (7-day TTL, `BOARD_VERSION`-gated).
- PDF export is client-side (`lib/moodboardPdf.ts`, WinAnsi-safe text).

### General Discovery (`/discover`)
Enter an org / website / email → scrape + search + LLM synthesis → auto-saved
to `segment='discover'` (never wiped by sheet syncs) → rendered as a full
dossier + moodboard.

---

## Access control

- One shared portal login (Basic Auth) for everyone.
- **AM editing** (single, bulk, release) is gated to a soft email allowlist in
  `lib/access.ts` — currently `raina.singhwi@`, `gunjan.kumari@`,
  `prateek@qalara.com`. Users self-identify by email (stored in
  `localStorage`); everyone else sees AMs read-only.
- **AM Notes** are editable by any signed-in user.

> This is a UI gate, not a hard security boundary — the shared login carries no
> per-user identity. Replace with SSO if a hard boundary is ever required.

---

## Environment variables

Set in Vercel (Production/Preview/Development) and in `.env.local` for local
dev. `.env.local` values are wrapped in single quotes.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB access |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Sheets service account (verbatim JSON) |
| `GOOGLE_SHEETS_SPREADSHEET_ID` (+ per-segment ids) | Sheet to sync |
| `SITE_USER`, `SITE_PASSWORD` | Basic Auth (unset `SITE_PASSWORD` locally to disable) |
| `TINYFISH_API_KEY` | TinyFish Search + Fetch |
| `FIRECRAWL_API_KEY` (+ `_BACKUP`) | Firecrawl scrape/screenshot |
| `CONTEXT_DEV_API_KEY` (+ backups) | context.dev moodboard data |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | LLM (moodboard, discovery) |
| `HUNTER_API_KEY` (+ `_BACKUP`) | Decision-maker emails |
| `APIFY_API_TOKEN`, `APIFY_ACTOR_ID` | Apify lookup |

---

## Database schema & migrations

Buyers live in the `leads` table (see the `Lead` interface in `lib/leads.ts`).
Schema changes are one-time SQL run in the Supabase SQL editor. Applied so far:

```sql
-- AM lock (dashboard AM changes survive a sheet sync)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS am_locked BOOLEAN NOT NULL DEFAULT false;

-- AM notes (dashboard-only, preserved across syncs)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes_updated_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes_updated_by TEXT;
```

---

## Local development

```bash
npm install
# .env.local must contain the env vars above.
# Disable Basic Auth locally so browser fetch() works without credentials-in-URL:
SITE_PASSWORD= npm run dev
```

Open http://localhost:3000.

> ⚠️ The local server talks to the **real** Supabase DB and Google Sheets (same
> `.env.local` credentials). Actions like assigning an AM or saving notes write
> to live data. There is no separate local database.

> ⚠️ Do **not** run `npm run build` while the dev server is running — it
> clobbers the dev `.next` cache. Stop the dev server first.

---

## Deploying

```bash
npm run build          # verify a clean build (dev server stopped)
git add -A && git commit -m "..."
git push origin master # GitHub: prateekparshwa/qalara-lms
npx vercel --prod --yes
```

Production deploys are done via the Vercel CLI. Schema changes must be applied
in Supabase **before** the deploy that depends on them.

---

## Project layout

```
app/
  page.tsx                    Landing lobby
  directory/[segment]/        Dashboard route
  discover/                   General Discovery
  api/leads/                  list, sync, export, assign-am(-bulk), notes, stats…
  api/enrich/                 search, scrape, moodboard, apify
  api/research/               Discovery pipeline
components/
  LeadsDashboard.tsx          Dashboard shell (state, fetch, bulk bar)
  LeadsTable.tsx, FilterPanel.tsx, MagazineHeader.tsx
  LeadDrawer.tsx              Buyer dossier drawer
  LeadDossier.tsx             Dossier sections (shared)
  NotesPanel.tsx              AM Notes
  EnrichPanel.tsx             Live Intelligence
  Moodboard.tsx               Brand moodboard
lib/
  leads.ts                    Queries + replaceSegmentLeads (sync core)
  google-sheets.ts            Sheet read + AM write-back
  sheet-schema.ts             Header → column mapping
  tinyfish.ts, firecrawl.ts, contextdev.ts, openrouter.ts   Enrichment clients
  access.ts                   AM-editor allowlist
  format.ts, glossary.ts      Formatting, tier logic, tags
  moodboardPdf.ts, leadPdf.ts jsPDF exports
middleware.ts                 Basic Auth gate
```

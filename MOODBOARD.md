# MOODBOARD.md — the Qalara buyer moodboard standard

The contract for every generated buyer moodboard (the dossier's left panel and
its PDF export). The pipeline (`app/api/enrich/moodboard/route.ts`, LLM prompt,
`components/Moodboard.tsx`, `lib/moodboardPdf.ts`) must follow this; change the
code and this file together.

**Purpose**: give a Qalara rep an at-a-glance feel for a buyer's brand — what
they sell, how it looks, how they speak, and what commercial programs they run —
good enough to walk into a sourcing conversation.

---

## 1. Data sources (per build)

| Layer | Source | Notes |
|---|---|---|
| Images | context.dev `/web/scrape/images` (1 cr) | filtered, max 12 |
| Brand identity | context.dev `/brand/retrieve` (10 cr) | logo, official colors, description, slogan, socials |
| Typography | context.dev `/web/styleguide` (10 cr) | real heading/body faces + font-file URLs |
| Site content | Firecrawl markdown scrape | feeds the LLM |
| Screenshot fallback | Firecrawl `screenshot@fullPage` | only when usable images < 4 |
| Editorial layer | OpenRouter LLM (Haiku primary, DeepSeek fallback) | one call per build |

Cache: `enrichment_cache.moodboard`, 7-day TTL. Never auto-build — only on
user action. Regenerate = `force: true`.

## 2. Image rules

- Prefer **campaign / lifestyle / product photography**; the filter must drop
  icons, logos, sprites, trackers, flags, placeholders, SVG/ICO/GIF.
- **Hero**: one wide image leads the board. Grid follows.
- **Labels**: every image that has alt text shows it as an editorial tag.
  The LLM may rewrite raw alt text into short curated tags (≤ 5 words,
  e.g. "High winter campaign", not "mss-2_tile---bedlinen_dt").
- If image scraping fails or yields < 4 usable images, show the full-page
  screenshot with an explanatory caption — never an empty board.

## 3. Brand essence (grounded, never fabricated)

- The panel shows a **brand essence**: ONE short, evocative sentence the LLM
  DERIVES from the scraped website content, written in the brand's own warm
  voice (like a tagline) — grounded synthesis, NOT a copied marketing slogan
  and NOT invented claims, numbers or awards.
- It must stay faithful to the site. If the content is too thin to derive a
  faithful essence, the LLM returns null and the panel is omitted
  ("if a brand essence is present, show it").
- Labelled "Brand essence".

## 4. Commercial programs (sourcing intel)

- Capture **membership / loyalty programs** (e.g. "Linen Lovers — 40% off,
  early access") and **own sub-brands / lines** (e.g. Adairs Kids, Mocka)
  as distinct items, separated from licensed third-party brands (NBA,
  Disney) — licensed names are noise, drop them unless the buyer's business
  IS licensing.
- Display: programs and sub-brands as solid chips; voice adjectives as
  outline chips.

## 5. Palette

- **6 swatches**, each with an evocative name + hex.
- Derived in priority order: official brand colors → colors evident in the
  **imagery and seasonal campaign** (warm story colors) → site accent colors.
- Site UI chrome colors (plain black/white/grey backgrounds and text) must
  NOT crowd out imagery colors — at most 2 neutral swatches.

## 6. Typography & voice

- Use the **real typefaces** from the styleguide endpoint, loaded via
  @font-face from the brand's own font files. Name them ("Display ·
  Beausite Slick").
- The type specimen secondary line shows **real words only** — the derived
  brand essence, else the brand name. Never a fabricated sentence.
- Voice = exactly 5 single-word adjectives that fit how the brand actually
  writes.
- PDF fallback: serif/sans stand-in matching each face's category, labeled
  with the real name.

## 7. Context dateline

- The masthead carries a one-line dateline: market/origin · current
  campaign or season (from the scraped content) · year.
  Example: "Australian home · High winter · Linen Lovers · 2026".

## 8. Board mood

- The panel/PDF canvas may be tinted with the palette's lightest neutral
  (paper tone) instead of pure white, so the board carries the brand's
  temperature.
- Footer always cites: source domain · season/campaign · "imagery via live
  site" · build date.

## 9. Quality bar (reject-and-retry triggers)

A board is below standard if any of these are true:
- tagline reads like it could belong to any brand in the category
- palette is mostly greys/blacks for a visually warm brand
- labels are raw filenames or raw alt strings
- licensed third-party names listed as the buyer's own collections

## 10. Cost discipline

~25 context.dev credits per build (images 5 + brand 10 + styleguide 10),
plus 1 Firecrawl scrape and 1 small LLM call. On-demand only, 7-day cache,
force-rebuild only from the Regenerate button.

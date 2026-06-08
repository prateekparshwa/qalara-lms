# Product

## Register

product

## Users

Qalara employees across the whole company — sales and business-development reps, account managers, sourcing, ops, and leadership. Technical comfort ranges widely, from power users who live in the data to occasional lookups by non-technical staff. They work on desktop, in focused bursts, usually with a specific buyer or prospect in mind. The portal lives at `lms.qalara.com` as an internal tool, not a public product.

## Product Purpose

A single, fast place to search, qualify, and research Qalara's HiPo buyer-lead database (currently ~3,600 leads, 52 fields each) without opening Excel. Two first-class jobs, weighted equally:

1. **Find & qualify a known lead** — search by organization, email, or website; open the full profile; decide whether it's worth pursuing.
2. **Research an unknown prospect** — look up an org never seen before and run live intelligence (Firecrawl website scrape, web search, Apify) to build a picture from scratch.

Success looks like: a rep finds the right lead and reads its full context in seconds, and can enrich a cold prospect without leaving the page. Data stays current via Google Sheets sync; results are exportable.

## Brand Personality

Precise, editorial, quietly premium. Voice is confident and information-first — it respects the reader's intelligence and gets out of the way. Calm, considered, never loud or corporate-generic. Three words: **precise, editorial, trustworthy.** The interface should feel like a well-set magazine spread of data, not a busy control panel. Emotional goal: the user trusts what they're looking at and feels the tool was built with care.

## Anti-references

- **Generic SaaS dashboard** — no blue-and-white admin template, no card grids everywhere, no gradient hero-metric tiles, no rounded-everything. It must not look like every other CRM.
- **Cluttered enterprise CRM (Salesforce-like)** — no dense wall of competing buttons, tabs, and panels. No cognitive overload.
- **Spreadsheet-in-a-browser** — not a raw data grid with no hierarchy. The profile view, typography, and rhythm must show craft; it must never feel like embedded Excel.
- Consumer-app playfulness (bright illustrations, emojis, bouncy motion) is also off-brand for a serious internal data tool.

## Design Principles

1. **Information-first, decoration-last.** Every pixel serves a lookup or a decision. The editorial styling carries hierarchy and calm; it never competes with the data.
2. **The tool disappears into the task.** Earned familiarity over novelty — standard affordances for standard actions (search, filter, sort, export), so any employee is fluent immediately.
3. **Depth on demand.** Show a scannable list by default; reveal the full 52-field profile and live intelligence only when the user asks. Density is available, never forced.
4. **Calm density.** Pack real information without clutter — whitespace, ruled dividers, and restrained color do the organizing, not boxes-within-boxes.
5. **Built with care, visibly.** Considered typography, consistent component vocabulary, and honest states (loading, empty, error) signal a tool the team can trust.

## Accessibility & Inclusion

Target **WCAG 2.1 AA.** Body text ≥4.5:1 contrast (including placeholders), large text ≥3:1. Full keyboard navigation with visible focus states. All interactive controls labeled (icon-only buttons get aria-labels). Honor `prefers-reduced-motion` with crossfade/instant fallbacks. Don't rely on color alone to convey state (confidence/classification badges pair color with text). Built for a broad internal audience, so readability beats cleverness everywhere.

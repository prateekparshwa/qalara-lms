---
name: Qalara LMS
description: Editorial admin portal for searching, qualifying, and enriching Qalara's HiPo buyer leads
colors:
  ink: "#18181B"
  secondary: "#3F3F46"
  accent: "#4F46E5"
  accent-teal: "#0D9488"
  accent-amber: "#F59E0B"
  accent-rose: "#E11D48"
  accent-violet: "#7C3AED"
  bg: "#FAFAFA"
  text: "#09090B"
  muted: "#71717A"
  border: "#E4E4E7"
  border-dark: "#27272A"
  surface: "#FFFFFF"
  badge-high-bg: "#DCFCE7"
  badge-high-text: "#15803D"
  badge-medium-bg: "#FEF9C3"
  badge-medium-text: "#A16207"
  badge-low-bg: "#F4F4F5"
  badge-low-text: "#71717A"
  badge-verified-bg: "#EFF6FF"
  badge-verified-text: "#1D4ED8"
typography:
  display:
    fontFamily: "Fira Code, monospace"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Fira Code, monospace"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  title:
    fontFamily: "Fira Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "Fira Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Fira Code, monospace"
    fontSize: "0.625rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.1em"
  data:
    fontFamily: "Fira Code, monospace"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
rounded:
  none: "0px"
  sm: "2px"
  md: "4px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
  filter-chip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  badge-confidence:
    backgroundColor: "{colors.badge-high-bg}"
    textColor: "{colors.badge-high-text}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  input-search:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "10px 36px"
  kpi-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "20px 0 16px"
---

# Design System: Qalara LMS

## 1. Overview

**Creative North Star: "The Newsroom Ledger"**

Qalara LMS reads like a well-set financial broadsheet rather than a control panel. The data is the headline; the interface is the typesetting around it. A monospaced display face (Fira Code) sets section labels, KPIs, and identifiers with the precision of a printed ledger, while a humanist sans (Fira Sans) carries the prose. Thin black rules organize the page the way a newspaper uses column separators: structure without boxes. The base is restrained so that the vibrant accent system (indigo for interaction; teal/amber/rose/violet for data) carries real meaning the instant it appears, rather than decorating.

This system explicitly rejects the **generic SaaS dashboard** (no blue-and-white template, no gradient hero-metric tiles, no rounded-everything), the **cluttered enterprise CRM** (no wall of competing buttons and tabs), and the **spreadsheet-in-a-browser** (the profile view and typographic rhythm must always show craft, never feel like embedded Excel). Density is welcome; clutter is not. Whitespace and rules do the organizing work that lazier systems hand to cards.

**Key Characteristics:**
- Monospace for identity and data; humanist sans for reading.
- Editorial black-and-off-white base; a five-color accent system (indigo/teal/amber/rose/violet) carries data and interaction.
- Hairline black rules instead of cards and shadows.
- Calm density: many fields, little noise.
- Honest states everywhere (loading skeletons, empty teaching states, error lines).

## 2. Colors

An editorial black-and-off-white base lifted by a vibrant five-color accent system. The base stays calm and typographic; color is injected deliberately at the data layer (KPIs, buyer-type tags) and the interaction layer (indigo for selection/focus).

### Primary
- **Indigo** (#4F46E5): The single *interactive* accent. Reserved for the active filter state, the chip dismiss control, the row-selection mark, focus rings, and the search-focus border. Never decorative.

### Accent Palette (data layer)
- **Indigo** (#4F46E5): Total Leads KPI; primary interaction.
- **Teal** (#0D9488): Verified Websites KPI; online/e-commerce buyer tags.
- **Amber** (#F59E0B / text #B45309): High-Confidence KPI; wholesaler/distributor tags.
- **Rose** (#E11D48): High-Priority KPI; interior/designer tags.
- **Violet** (#7C3AED): Importer tags.

Each KPI card carries its own accent on the top-rule and number. Buyer-type tags use soft tints (light bg + saturated text) of these hues, color-coded by buyer kind so the table scans by color.

### Neutral
- **Editorial Ink** (#18181B): Primary text, wordmark, table headers, rules, and the fill of the primary button on hover. The structural voice of the whole system.
- **Graphite** (#3F3F46): Secondary text and field values inside the profile drawer.
- **Muted Slate** (#71717A): Labels, metadata, captions, placeholder text. Always at ≥4.5:1 on white/off-white.
- **Off-White Body** (#FAFAFA): The page background and the resting input fill.
- **Surface White** (#FFFFFF): Cards, panels, table, and drawer surface; the second neutral layer above the body.
- **Hairline** (#E4E4E7): Light rules, table row separators, input borders.
- **Near-Black Ink** (#09090B): The darkest text token for highest-contrast values.

### Semantic (confidence & classification)
- **Confidence High** (text #15803D on #DCFCE7): Verified / high-confidence website and HIGH buyer classification.
- **Confidence Medium** (text #A16207 on #FEF9C3): Medium confidence.
- **Confidence Low** (text #71717A on #F4F4F5): Low or unverified.
- **Verified Blue** (text #1D4ED8 on #EFF6FF): Website-present marker.

### Named Rules
**The One Interaction Color Rule.** Indigo (#4F46E5) is the only color that signals interactivity (selection, focus, active filter). The other four accents are reserved for *data* (KPIs, buyer-type tags) and never used for hover/active states, so users always know what indigo means.

**The Rules-Not-Boxes Rule.** Grouping is done with 1px rules (ink for section dividers, hairline for rows), never with bordered cards. Nested cards are forbidden.

## 3. Typography

**Display Font:** Fira Code (with `monospace` fallback)
**Body Font:** Fira Sans (with `sans-serif` fallback)

**Character:** A deliberate contrast pairing on the mono-vs-humanist axis: Fira Code's fixed-width precision signals "this is data and identity," while Fira Sans reads warmly for prose. Two members of the same superfamily, so they share skeleton and never clash.

### Hierarchy
- **Display** (Fira Code, 700, 1.5rem, line-height 1.1): The `QALARA · LEADS` wordmark and drawer org name.
- **Headline** (Fira Code, 700, 1.125rem): Lead organization name at the top of the profile drawer.
- **Title** (Fira Sans, 600, 0.875rem): Organization name in table rows; emphasized field values.
- **Body** (Fira Sans, 400, 0.875rem, line-height 1.6): Field values, descriptions, prose. Cap prose at 65–75ch; data cells may run denser.
- **Label** (Fira Code, 700, 0.625rem, letter-spacing 0.1em, uppercase): Section headers, column headers, field labels. Reserved for ≤4-word labels only.
- **Data** (Fira Code, 700, 2rem): KPI numbers in the stats bar.

### Named Rules
**The Mono-for-Identity Rule.** Anything that identifies or quantifies (labels, KPIs, IDs, confidence badges, dates) is set in Fira Code. Anything read as language is set in Fira Sans. The font itself tells the user what kind of thing they're looking at.

**The Short-Caps-Only Rule.** Uppercase is permitted only for labels of four words or fewer. Sentences are never set in caps.

## 4. Elevation

The system is flat by default. Depth is conveyed through tonal layering (off-white body #FAFAFA beneath surface white #FFFFFF) and hairline rules, not shadows. The only two exceptions are floating layers that genuinely sit above the page: the slide-over drawer and the toast notification.

### Shadow Vocabulary
- **Drawer lift** (`box-shadow: -4px 0 24px rgba(0,0,0,0.08)`): Only on the lead profile drawer, signaling it sits above the table.
- **Toast lift** (`box-shadow: 0 8px 24px rgba(0,0,0,0.10)`): Only on the transient status toast, which floats above everything (z-60).

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. The only shadows in the system belong to genuinely floating layers (the drawer and the toast). If a card needs a shadow to separate from its background, use a rule or a tonal step instead.

## 5. Components

### Buttons
- **Shape:** Square-ish, 4px radius (`{rounded.md}`). No pills for actions.
- **Primary (Export):** Outlined ink on white — `border: 1px solid #18181B`, ink text, transparent fill. Editorial restraint; the button is quiet until used.
- **Hover / Focus:** Inverts to filled ink (#18181B) with white text over 150ms. Visible focus ring for keyboard users.
- **Secondary (Sync):** Outlined in hairline (#E4E4E7) with graphite text; border darkens to ink on hover. The spinning refresh icon during sync conveys loading state.

### Chips (filters)
- **Style:** Ink fill (#18181B), white text, fully pilled (`{rounded.pill}`), 2px×8px padding.
- **State:** Only the *active* filters render as chips; the indigo `×` dismiss is the accent's job. Unselected options live in the sidebar selects, not as chips.

### Buyer-Type Tags
- **Style:** Soft pill, light tinted background + saturated text, color-coded by buyer kind (retail=indigo, online=teal, wholesale=amber, importer=violet, designer=rose). Fira Sans 11px, fully pilled, truncates with a `title` tooltip.

### Badges (priority / confidence)
- **Style:** One shared `Badge` component (`components/Badge.tsx`) renders both buyer priority and website confidence. Tiny Fira Code, uppercase, 2px radius, semantic bg+text pair: HIGH green (#DCFCE7/#15803D), MED amber (#FEF9C3/#A16207), LOW gray (#F4F4F5/#71717A). Null renders a muted em-dash, not an empty pill. Color is always paired with the text value, never the sole signal, and every badge carries a plain-language tooltip from `lib/glossary.ts`.

### Cards / Containers
- **KPI "pull-quote" cards:** No border box. A 3px ink top-rule, a large Fira Code number, and a muted uppercase label beneath. Separated from siblings by a hairline vertical rule, not card chrome.
- **Corner Style:** Sharp (0px) for KPI blocks; 4px only on interactive controls.
- **Shadow Strategy:** None (see Elevation).

### Inputs / Fields
- **Style:** Off-white fill (#FAFAFA), 1px hairline border, 4px radius, leading search icon.
- **Focus:** Fill brightens to white and border shifts to ink (#18181B); no glow.
- **Placeholder:** Muted slate at ≥4.5:1, never lighter.

### Navigation / Header
- **Style:** Sticky white header topped by a thin (4px) left-to-right gradient accent strip (indigo→violet→teal→amber→rose) — the one place all five accents appear together. Wordmark in Fira Code with an indigo middot. A full-width 1px ink rule separates the masthead from the search bar — the "broadsheet" gesture.

### Signature Component — The Leads Row
A table row with a 3px transparent left edge that turns indigo on hover/focus, with the row tinting to #F4F4F5. The editorial "selection mark" in the margin, like a reader's pencil tick. Clicking (or Enter/Space) opens the profile drawer.

### Signature Component — The Intelligence Terminal
Live-enrichment results render in an ink (#18181B) panel with light Fira Code text — a deliberate "terminal in the margin." It visually separates machine-fetched intelligence from the curated database fields above it.

## 6. Do's and Don'ts

### Do:
- **Do** reserve indigo (#4F46E5) for interaction only (active filters, row mark, focus, dismiss); use teal/amber/rose/violet for data (KPIs, tags), never for hover/active states.
- **Do** organize with 1px rules: ink (#18181B) for section dividers, hairline (#E4E4E7) for table rows.
- **Do** set every label, KPI, badge, and identifier in Fira Code; set every reading sentence in Fira Sans.
- **Do** pair every confidence/classification color with its text value, so color is never the only signal (WCAG AA).
- **Do** ship honest states: skeleton rows while loading, a teaching empty state ("No leads found matching your search."), inline error lines in the terminal.
- **Do** keep body and placeholder text at ≥4.5:1 contrast; bump toward ink before reaching for a lighter gray.

### Don't:
- **Don't** build a **generic SaaS dashboard**: no gradient hero-metric tiles, no blue-and-white template, no rounded-everything.
- **Don't** build a **cluttered enterprise CRM**: no wall of competing buttons, tabs, and panels fighting for attention.
- **Don't** let it become a **spreadsheet-in-a-browser**: the drawer, typography, and rhythm must always show craft.
- **Don't** use cards where a rule will do, and never nest cards.
- **Don't** add shadows to anything except the drawer (see The Flat-By-Default Rule).
- **Don't** use `border-left`/`border-right` greater than the 3px indigo row mark as a colored stripe on callouts or alerts.
- **Don't** introduce consumer-app playfulness: no emojis as icons (Lucide SVG only), no bouncy/elastic motion, no illustrations.
- **Don't** set body copy in ALL CAPS or use uppercase for anything longer than a four-word label.

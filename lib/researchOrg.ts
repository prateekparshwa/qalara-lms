/**
 * Shared web-research orchestration: scrape + search + LLM synthesis + POC
 * lookup, producing a `leads`-table-shaped row from just an org name,
 * website, email, contact name, and/or country.
 *
 * Extracted from app/api/research/route.ts (General Discovery) so a second
 * caller — the Tracker sync's "create new org" flow — can reuse the exact
 * same enrichment pipeline instead of re-implementing it. The Discovery
 * route still owns saving the result to the `discover` segment; this
 * function only produces the researched fields.
 */

import { firecrawlScrape, firecrawlSearch } from "./firecrawl";
import { openrouterComplete, parseJsonLoose } from "./openrouter";
import { findContactViaHunter } from "./hunter";
import { vibeProspect } from "./vibeProspect";
import { harvestFromText, toDomain } from "./contact";
import type { DecisionMaker } from "./apollo";
import {
  RESEARCH_FIELDS,
  buildResearchSystemPrompt,
  buildResearchUserPrompt,
} from "./discovery";

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "null" || s.toLowerCase() === "n/a"
    ? null
    : s;
}

const ALLOWED = new Set(RESEARCH_FIELDS.map((f) => f.column));

const MODEL_CHOICES: Record<string, string> = {
  haiku: "anthropic/claude-haiku-4.5",
  deepseek: "deepseek/deepseek-v4-flash",
  qwen: "qwen/qwen3.6-plus:free",
};

export interface ResearchInput {
  org?: string;
  website?: string;
  email?: string;
  buyerName?: string;
  country?: string;
  model?: string;
}

export interface ResearchResult {
  row: Record<string, string | null>;
  usedScrape: boolean;
  searchCount: number;
  contactSource: string | null;
}

/** Runs the full research pipeline. Throws on a fatal input/config/network
 * error (caller decides how to surface it) — never partially applies. */
export async function researchOrgProfile(
  input: ResearchInput
): Promise<ResearchResult> {
  const org = clean(input.org) ?? undefined;
  const website = clean(input.website) ?? undefined;
  const email = clean(input.email) ?? undefined;
  const buyerName = clean(input.buyerName) ?? undefined;
  const country = clean(input.country) ?? undefined;
  const model = MODEL_CHOICES[input.model ?? ""] ?? undefined;

  if (!org && !website && !email) {
    throw new Error("Enter an organization, website, or email to research.");
  }
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("Research isn't configured yet (missing OPENROUTER_API_KEY).");
  }

  // 1. Gather web context: scrape the site (if given) + a web search.
  const fcStatus: { quota?: boolean } = {};
  const scrape = website ? await firecrawlScrape(website, fcStatus) : null;
  const searchQuery = [org, website, email, buyerName, country, "company profile buyer"]
    .filter(Boolean)
    .join(" ");
  const socialQuery = [org || website || email, country, "instagram OR linkedin OR facebook official page"]
    .filter(Boolean)
    .join(" ");
  const [hits, socialHits] = await Promise.all([
    firecrawlSearch(searchQuery, 5, fcStatus),
    firecrawlSearch(socialQuery, 4, fcStatus),
  ]);

  const contextParts: string[] = [];
  if (scrape?.markdown) {
    contextParts.push(`# Website content\n${scrape.markdown.slice(0, 8000)}`);
  }
  if (hits.length) {
    contextParts.push(
      `# Web search results\n` +
        hits.map((h) => `- ${h.title} (${h.url})\n  ${h.description}`).join("\n")
    );
  }
  const newSocial = socialHits.filter((s) => !hits.some((h) => h.url === s.url));
  if (newSocial.length) {
    contextParts.push(
      `# Social profile search results\n` +
        newSocial.map((h) => `- ${h.title} (${h.url})\n  ${h.description}`).join("\n")
    );
  }
  let context = contextParts.join("\n\n");

  let webPluginUsed = false;
  if (!context.trim()) {
    if (fcStatus.quota) {
      webPluginUsed = true;
      context =
        "(No scraped content available — SEARCH THE WEB yourself for this organization's website, LinkedIn, and trade listings, and base the profile on what you find.)";
    } else {
      throw new Error(
        "Couldn't find any web information for that input. Try a website URL or a more specific organization name."
      );
    }
  }

  // 2. Synthesize the profile with the LLM.
  const raw = await openrouterComplete(
    buildResearchSystemPrompt(),
    buildResearchUserPrompt({ org, website, email, buyerName, country }, context),
    { model, webSearch: webPluginUsed || undefined }
  );
  const parsed = parseJsonLoose(raw);

  // 3. Build the row (only allowed research columns), backfill from inputs.
  const row: Record<string, string | null> = {};
  for (const f of RESEARCH_FIELDS) {
    row[f.column] = clean(parsed[f.column]);
  }
  row.organization = row.organization ?? org ?? null;
  row.website = row.website ?? website ?? null;
  row.email = row.email ?? email ?? null;
  row.full_name = row.full_name ?? buyerName ?? null;
  row.country = row.country ?? country ?? null;

  // 3b. POC lookup — fill missing contact fields via Hunter, then a vibe
  // prospecting fallback, then a harvest from the scraped page text.
  let contactSource: string | null = null;
  const domain = toDomain(row.website);
  const missingPoc = !row.full_name || !row.designation || !row.email || !row.phone;
  if (domain && missingPoc) {
    const pocFields: (keyof DecisionMaker)[] = [
      "full_name",
      "designation",
      "email",
      "phone",
      "linkedin_url",
    ];
    const fillFrom = (contact: DecisionMaker | null) => {
      if (!contact) return;
      for (const k of pocFields) {
        const found = clean(contact[k]);
        if (found && !row[k]) {
          row[k] = found;
          contactSource = contactSource ?? contact.source;
        }
      }
    };
    try {
      fillFrom(await findContactViaHunter(domain));
    } catch {
      /* Hunter quota/error — keep whatever the research found */
    }
    if (!row.full_name) {
      fillFrom(await vibeProspect(row.organization, domain));
    }
    if ((!row.email || !row.phone) && scrape?.markdown) {
      const harvested = harvestFromText(scrape.markdown, domain);
      if (!row.email && harvested.email) {
        row.email = harvested.email;
        contactSource = contactSource ?? "Website";
      }
      if (!row.phone && harvested.phone) {
        row.phone = harvested.phone;
        contactSource = contactSource ?? "Website";
      }
    }
  }

  if (!row.organization && !row.website && !row.email) {
    throw new Error("Research produced no usable fields. Try again.");
  }

  return {
    row: Object.fromEntries(Object.entries(row).filter(([k]) => ALLOWED.has(k))),
    usedScrape: !!scrape?.markdown,
    searchCount: hits.length,
    contactSource,
  };
}

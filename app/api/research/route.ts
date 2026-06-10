import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { priorityRank } from "@/lib/leads";
import { DISCOVER_SEGMENT } from "@/lib/segments";
import { firecrawlScrape, firecrawlSearch } from "@/lib/firecrawl";
import { openrouterComplete, parseJsonLoose } from "@/lib/openrouter";
import { findContactViaHunter } from "@/lib/hunter";
import { vibeProspect } from "@/lib/vibeProspect";
import { harvestFromText, toDomain } from "@/lib/contact";
import type { DecisionMaker } from "@/lib/apollo";
import {
  RESEARCH_FIELDS,
  buildResearchSystemPrompt,
  buildResearchUserPrompt,
} from "@/lib/discovery";

export const runtime = "nodejs";
export const maxDuration = 60;

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "null" || s.toLowerCase() === "n/a"
    ? null
    : s;
}

const ALLOWED = new Set(RESEARCH_FIELDS.map((f) => f.column));

// User-selectable research models (whitelist — never trust a raw model id).
const MODEL_CHOICES: Record<string, string> = {
  haiku: "anthropic/claude-haiku-4.5",
  deepseek: "deepseek/deepseek-v4-flash",
  qwen: "qwen/qwen3.6-plus:free",
};

export async function POST(req: NextRequest) {
  let body: {
    org?: string;
    website?: string;
    email?: string;
    buyerName?: string;
    country?: string;
    model?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const org = clean(body.org) ?? undefined;
  const website = clean(body.website) ?? undefined;
  const email = clean(body.email) ?? undefined;
  const buyerName = clean(body.buyerName) ?? undefined;
  const country = clean(body.country) ?? undefined;
  const model = MODEL_CHOICES[body.model ?? ""] ?? undefined;

  if (!org && !website && !email) {
    return NextResponse.json(
      { error: "Enter an organization, website, or email to research." },
      { status: 400 }
    );
  }
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "Research isn't configured yet (missing OPENROUTER_API_KEY)." },
      { status: 200 }
    );
  }

  try {
    // 1. Gather web context: scrape the site (if given) + a web search.
    const fcStatus: { quota?: boolean } = {};
    const scrape = website ? await firecrawlScrape(website, fcStatus) : null;
    const searchQuery = [org, website, email, buyerName, country, "company profile buyer"]
      .filter(Boolean)
      .join(" ");
    // Dedicated social pass — the company-profile query rarely surfaces
    // Instagram/LinkedIn/Facebook profiles, so search for them explicitly.
    const socialQuery = [org || website || email, country, "instagram OR linkedin OR facebook official page"]
      .filter(Boolean)
      .join(" ");
    const [hits, socialHits] = await Promise.all([
      firecrawlSearch(searchQuery, 5, fcStatus),
      firecrawlSearch(socialQuery, 4, fcStatus),
    ]);

    const contextParts: string[] = [];
    if (scrape?.markdown) {
      contextParts.push(`# Website content\n${scrape.markdown}`);
    }
    if (hits.length) {
      contextParts.push(
        `# Web search results\n` +
          hits
            .map((h) => `- ${h.title} (${h.url})\n  ${h.description}`)
            .join("\n")
      );
    }
    const newSocial = socialHits.filter(
      (s) => !hits.some((h) => h.url === s.url)
    );
    if (newSocial.length) {
      contextParts.push(
        `# Social profile search results\n` +
          newSocial
            .map((h) => `- ${h.title} (${h.url})\n  ${h.description}`)
            .join("\n")
      );
    }
    let context = contextParts.join("\n\n");

    // Firecrawl out of credits → fall back to OpenRouter's web-search plugin:
    // the model searches the web itself (engine: Firecrawl, billed to the
    // OpenRouter integration credits instead of our direct key).
    let webPluginUsed = false;
    if (!context.trim()) {
      if (fcStatus.quota) {
        webPluginUsed = true;
        context =
          "(No scraped content available — SEARCH THE WEB yourself for this organization's website, LinkedIn, and trade listings, and base the profile on what you find.)";
      } else {
        return NextResponse.json(
          {
            error:
              "Couldn't find any web information for that input. Try a website URL or a more specific organization name.",
          },
          { status: 422 }
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

    // 3b. POC lookup — fill missing contact fields (name, designation, email,
    // phone, LinkedIn) via Hunter.io, ranked toward sourcing/purchasing/buyer
    // roles. Best-effort: a Hunter failure never fails the research.
    let contactSource: string | null = null;
    const domain = toDomain(row.website);
    const missingPoc =
      !row.full_name || !row.designation || !row.email || !row.phone;
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
      // Vibe prospecting fallback — AI web search when Hunter named no one.
      if (!row.full_name) {
        fillFrom(await vibeProspect(row.organization, domain));
      }
      // Last resort: harvest a generic email/phone from the scraped site.
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
      return NextResponse.json(
        { error: "Research produced no usable fields. Try again." },
        { status: 422 }
      );
    }

    // 4. Auto-save into the 'discover' segment, de-duplicated.
    const record = {
      ...Object.fromEntries(
        Object.entries(row).filter(([k]) => ALLOWED.has(k))
      ),
      segment: DISCOVER_SEGMENT,
      source: "Web Research",
      priority_rank: priorityRank(null),
      imported_at: new Date().toISOString(),
      enriched_at: new Date().toISOString(),
    };

    // Find an existing discovered row by website → email → organization.
    let existingId: number | null = null;
    const matchers: [string, string | null][] = [
      ["website", row.website],
      ["email", row.email],
      ["organization", row.organization],
    ];
    for (const [col, val] of matchers) {
      if (!val) continue;
      const { data } = await supabaseAdmin
        .from("leads")
        .select("id")
        .eq("segment", DISCOVER_SEGMENT)
        .ilike(col, val)
        .limit(1)
        .maybeSingle();
      if (data?.id) {
        existingId = data.id as number;
        break;
      }
    }

    let savedId = existingId;
    if (existingId) {
      const { error } = await supabaseAdmin
        .from("leads")
        .update(record)
        .eq("id", existingId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await supabaseAdmin
        .from("leads")
        .insert(record)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      savedId = data?.id ?? null;
    }

    return NextResponse.json({
      profile: row,
      savedId,
      updated: !!existingId,
      usedScrape: !!scrape?.markdown,
      searchCount: hits.length,
      contactSource,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Research failed." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { priorityRank } from "@/lib/leads";
import { DISCOVER_SEGMENT } from "@/lib/segments";
import { firecrawlScrape, firecrawlSearch } from "@/lib/firecrawl";
import { openrouterComplete, parseJsonLoose } from "@/lib/openrouter";
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

export async function POST(req: NextRequest) {
  let body: { org?: string; website?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const org = clean(body.org) ?? undefined;
  const website = clean(body.website) ?? undefined;
  const email = clean(body.email) ?? undefined;

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
    const searchQuery = [org, website, email, "company profile buyer"]
      .filter(Boolean)
      .join(" ");
    const hits = await firecrawlSearch(searchQuery, 5, fcStatus);

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
    const context = contextParts.join("\n\n");

    if (!context.trim()) {
      if (fcStatus.quota) {
        return NextResponse.json(
          {
            error:
              "Web research is temporarily unavailable — the research service is out of quota. Please try again later or contact the admin.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        {
          error:
            "Couldn't find any web information for that input. Try a website URL or a more specific organization name.",
        },
        { status: 422 }
      );
    }

    // 2. Synthesize the profile with the LLM.
    const raw = await openrouterComplete(
      buildResearchSystemPrompt(),
      buildResearchUserPrompt({ org, website, email }, context)
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
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Research failed." },
      { status: 500 }
    );
  }
}

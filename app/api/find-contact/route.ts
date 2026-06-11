import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { DecisionMaker } from "@/lib/apollo";
import { findContactViaHunter } from "@/lib/hunter";
import { vibeProspect } from "@/lib/vibeProspect";
import { apifyContactScrape, apifyLinkedInProfile } from "@/lib/apifyContacts";
import { firecrawlScrape } from "@/lib/firecrawl";
import { harvestFromText, toDomain } from "@/lib/contact";

export const runtime = "nodejs";
export const maxDuration = 60;

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "null" ? null : s;
}

export async function POST(req: NextRequest) {
  let body: { leadId?: number; org?: string; website?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const org = clean(body.org) ?? undefined;
  const website = clean(body.website) ?? undefined;
  const domain = toDomain(website);

  if (!domain) {
    return NextResponse.json(
      { error: "A website is needed to find a decision-maker." },
      { status: 400 }
    );
  }

  try {
    // 1. Hunter — find the decision-maker (name + title + email) by domain.
    let contact: DecisionMaker | null = null;
    let providerError: string | null = null;
    if (process.env.HUNTER_API_KEY || process.env.HUNTER_API_KEY_BACKUP) {
      try {
        contact = await findContactViaHunter(domain);
      } catch (e) {
        providerError = e instanceof Error ? e.message : "Hunter error";
      }
    } else {
      providerError = "Hunter not configured";
    }

    // 2. Vibe prospecting fallback — AI web search when Hunter named no one.
    if (!contact?.full_name) {
      const vibe = await vibeProspect(org ?? null, domain);
      if (vibe) {
        contact = {
          full_name: contact?.full_name ?? vibe.full_name,
          designation: contact?.designation ?? vibe.designation,
          email: contact?.email ?? vibe.email,
          phone: contact?.phone ?? vibe.phone,
          linkedin_url: contact?.linkedin_url ?? vibe.linkedin_url,
          source: contact?.source
            ? `${contact.source} + ${vibe.source}`
            : vibe.source,
        };
      }
    }

    // 3. LinkedIn profile scrape — when we know WHO (a /in/ LinkedIn URL)
    //    but lack their email, pull it from their profile via Apify.
    if (contact?.linkedin_url && !contact.email) {
      const li = await apifyLinkedInProfile(contact.linkedin_url);
      if (li) {
        contact = {
          ...contact,
          full_name: contact.full_name ?? li.full_name,
          designation: contact.designation ?? li.designation,
          email: li.email ?? contact.email,
          source: li.email
            ? `${contact.source} + LinkedIn scrape`
            : contact.source,
        };
      }
    }

    // 4. Apify deep-crawl fallback — emails/phones from contact/about pages.
    //    Skipped automatically when APIFY_API_TOKEN isn't configured.
    if (!contact?.email || !contact?.phone) {
      const apify = await apifyContactScrape(domain);
      if (apify) {
        contact = {
          full_name: contact?.full_name ?? null,
          designation: contact?.designation ?? null,
          email: contact?.email ?? apify.email,
          phone: contact?.phone ?? apify.phone,
          linkedin_url: contact?.linkedin_url ?? apify.linkedin_url,
          source: contact?.source
            ? `${contact.source} + Apify`
            : "Apify (site crawl)",
        };
      }
    }

    // 5. Firecrawl fallback — fill any missing email/phone from the site.
    if (!contact || !contact.email || !contact.phone) {
      const scrape = await firecrawlScrape(website!);
      if (scrape?.markdown) {
        const harvested = harvestFromText(scrape.markdown, domain);
        contact = {
          full_name: contact?.full_name ?? null,
          designation: contact?.designation ?? null,
          email: contact?.email ?? harvested.email,
          phone: contact?.phone ?? harvested.phone,
          linkedin_url: contact?.linkedin_url ?? null,
          source: contact?.source
            ? `${contact.source} + website`
            : "Website",
        };
      }
    }

    if (!contact || (!contact.email && !contact.phone && !contact.full_name)) {
      return NextResponse.json(
        {
          error: providerError
            ? `No contact found (${providerError}).`
            : "No decision-maker contact could be found for this company.",
        },
        { status: 404 }
      );
    }

    // 6. Fill gaps on the lead (never overwrite existing values).
    let filled: string[] = [];
    if (body.leadId) {
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("full_name, designation, email, phone, linkedin_url")
        .eq("id", body.leadId)
        .maybeSingle();

      const updates: Record<string, string> = {};
      const consider: [keyof DecisionMaker, string][] = [
        ["full_name", "full_name"],
        ["designation", "designation"],
        ["email", "email"],
        ["phone", "phone"],
        ["linkedin_url", "linkedin_url"],
      ];
      for (const [k, col] of consider) {
        const found = clean(contact[k]);
        const existing = clean((lead as Record<string, unknown>)?.[col]);
        if (found && !existing) updates[col] = found;
      }
      if (Object.keys(updates).length > 0) {
        const { error } = await supabaseAdmin
          .from("leads")
          .update(updates)
          .eq("id", body.leadId);
        if (!error) filled = Object.keys(updates);
      }
    }

    const note =
      providerError && contact.source && /website/i.test(contact.source)
        ? `Hunter unavailable (${providerError}) — used website fallback.`
        : undefined;

    return NextResponse.json({ contact, filled, note });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lookup failed." },
      { status: 500 }
    );
  }
}

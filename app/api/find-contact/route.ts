import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { DecisionMaker } from "@/lib/apollo";
import { findContactViaHunter } from "@/lib/hunter";
import { firecrawlScrape } from "@/lib/firecrawl";

export const runtime = "nodejs";
export const maxDuration = 60;

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "null" ? null : s;
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g;
const EMAIL_NOISE = /(no-?reply|example\.|sentry|\.png|\.jpg|\.svg|@2x|wixpress|godaddy)/i;
const DATE_LIKE = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/; // 2025-09-23 etc.

function looksLikePhone(raw: string): boolean {
  const p = raw.trim();
  if (DATE_LIKE.test(p)) return false;
  const digits = p.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return false;
  // Require phone-ish formatting (+, parens, spaces) or a longer run of digits.
  return /[+()\s]/.test(p) || digits.length >= 10;
}

function harvestFromText(text: string, domain: string) {
  const emails = Array.from(new Set(text.match(EMAIL_RE) ?? []))
    .map((e) => e.toLowerCase())
    .filter((e) => !EMAIL_NOISE.test(e));
  // Prefer an email on the company's own domain.
  const onDomain = emails.find((e) => domain && e.endsWith(`@${domain}`));
  const email = onDomain || emails[0] || null;
  const phone = (text.match(PHONE_RE) ?? []).map((p) => p.trim()).find(looksLikePhone);
  return { email, phone: phone ?? null };
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
  const domain = website
    ? website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "")
    : "";

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
    if (process.env.HUNTER_API_KEY) {
      try {
        contact = await findContactViaHunter(domain);
      } catch (e) {
        providerError = e instanceof Error ? e.message : "Hunter error";
      }
    } else {
      providerError = "Hunter not configured";
    }

    // 2. Firecrawl fallback — fill any missing email/phone from the site.
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

    // 3. Fill gaps on the lead (never overwrite existing values).
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

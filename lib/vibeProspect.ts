/**
 * "Vibe prospecting" (server-only) — AI-driven decision-maker lookup used as
 * the fallback when Hunter.io can't name a person. Runs targeted web searches
 * (Firecrawl) for sourcing/purchasing/buying roles at the company, then has
 * the LLM extract the single best contact from the results.
 *
 * Strictly evidence-based: the LLM is told to never invent emails or phones,
 * so sparse results return mostly-null fields rather than hallucinations.
 */
import { firecrawlSearch } from "./firecrawl";
import { openrouterComplete, parseJsonLoose } from "./openrouter";
import type { DecisionMaker } from "./apollo";

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "null" || s.toLowerCase() === "n/a"
    ? null
    : s;
}

const SYSTEM = [
  "You identify the single best decision-maker contact at a company for B2B sourcing outreach (Qalara connects global buyers with Indian home & lifestyle suppliers).",
  "Preferred titles, in order: Sourcing Manager, Purchase/Procurement Manager, Senior Buyer, Director of Sourcing/Purchasing, Category Manager, Merchandiser; then Founder, Owner, Managing Director, CEO.",
  "Rules:",
  "- Return ONLY a single JSON object, no prose, no markdown fences: {\"full_name\", \"designation\", \"email\", \"phone\", \"linkedin_url\"}.",
  "- Every value must be evidenced by the search results. Use null when not shown — NEVER invent or guess an email address or phone number.",
  "- Pick exactly one person (the best-ranked by the title order above). If no named person appears, return all nulls.",
].join("\n");

export async function vibeProspect(
  orgName: string | null,
  domain: string
): Promise<DecisionMaker | null> {
  const name = clean(orgName) ?? domain;
  if (!name || !process.env.OPENROUTER_API_KEY) return null;

  const queries = [
    `"${name}" sourcing OR purchasing OR procurement manager OR buyer LinkedIn`,
    `"${name}" ${domain} founder OR owner OR director contact email`,
  ];
  const hits = (
    await Promise.all(queries.map((q) => firecrawlSearch(q, 5)))
  ).flat();
  if (hits.length === 0) return null;

  const context = hits
    .map((h) => `- ${h.title} (${h.url})\n  ${h.description}`)
    .join("\n");

  try {
    const raw = await openrouterComplete(
      SYSTEM,
      [
        `Company: ${name}`,
        `Website domain: ${domain || "(unknown)"}`,
        ``,
        `Web search results:`,
        `"""`,
        context.slice(0, 8000),
        `"""`,
        ``,
        `Return the JSON object now.`,
      ].join("\n")
    );
    const p = parseJsonLoose(raw);
    const contact: DecisionMaker = {
      full_name: clean(p.full_name),
      designation: clean(p.designation),
      email: clean(p.email),
      phone: clean(p.phone),
      linkedin_url: clean(p.linkedin_url),
      source: "Vibe prospecting (AI web search)",
    };
    // Only useful if it actually named someone or found a direct channel.
    if (!contact.full_name && !contact.email && !contact.linkedin_url) {
      return null;
    }
    return contact;
  } catch {
    return null;
  }
}

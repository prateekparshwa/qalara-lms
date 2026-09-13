/**
 * Condense a pulled email for the dossier's summary fields. No model call —
 * this runs on every sync, for free.
 *
 * It keeps only the newest message (drops the quoted reply chain, the
 * signature and the HubSpot footer) and trims that to a few sentences, so the
 * field shows what this email actually says rather than the first 300
 * characters of a whole thread. It is an excerpt, not a written summary:
 * leads whose summary was hand-written are left alone by the sync until a
 * newer email arrives.
 */

const REPLY_CHAIN_MARKERS = [
  /\n\s*On [^\n]{0,200}\n?[^\n]{0,120}wrote:\s*\n/i,
  /\n\s*-{2,}\s*Original Message\s*-{2,}/i,
  /\n\s*From:\s[^\n]+\n\s*(Sent|Date):/i,
  /\n\s*>/,
];

const SIGN_OFF =
  /\n\s*(warm regards|best regards|kind regards|regards|best|thanks|thank you|many thanks|cheers|sincerely)\s*,?\s*\n/i;

/** The newest message only, as plain text. */
export function newestMessage(raw: string): string {
  let text = (raw ?? "")
    .replace(/\r/g, "")
    .replace(/^\s*\d{4}-\d{2}-\d{2}\s*[—-]\s*/, "");

  for (const marker of REPLY_CHAIN_MARKERS) {
    const m = text.match(marker);
    // A marker in the first few characters is the message itself, not a quote.
    if (m && m.index !== undefined && m.index > 20) text = text.slice(0, m.index);
  }

  text = text
    .replace(/Powered by HubSpot[\s\S]*$/i, "")
    .replace(/<https?:\/\/[^>]+>/g, "");

  const signOff = text.search(SIGN_OFF);
  if (signOff > 40) text = text.slice(0, signOff);

  return text.replace(/[\t ]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

/** A few sentences (~320 chars) of the newest message, greeting dropped. */
export function emailExcerpt(raw: string): string {
  const clean = newestMessage(raw)
    .replace(/^(hi|hello|dear|hey)\b[^\n]*\n+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= 320) return clean;
  const cut = clean.slice(0, 320);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (lastStop > 120 ? cut.slice(0, lastStop + 1) : cut) + "…";
}

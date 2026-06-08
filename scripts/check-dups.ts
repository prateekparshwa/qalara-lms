import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

async function main() {
  const { readLeadsSheet } = await import("../lib/google-sheets");
  const { rows } = await readLeadsSheet();
  const seen = new Map<string, number>();
  let dupPairs = 0;
  let nonNullEmail = 0;
  for (const r of rows) {
    const org = (r.organization ?? "").toString().trim().toLowerCase();
    const email = (r.email ?? "").toString().trim().toLowerCase();
    if (email) nonNullEmail++;
    // The partial index is typically on (org,email) WHERE email IS NOT NULL.
    if (!email) continue;
    const key = `${org}||${email}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (n === 2) dupPairs++;
  }
  console.log("total rows:        ", rows.length);
  console.log("rows w/ email:     ", nonNullEmail);
  console.log("duplicate (org,email) pairs (non-null email):", dupPairs);
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

import { NextRequest, NextResponse } from "next/server";

/**
 * Lightweight HTTP Basic Auth gate for the whole portal.
 *
 * Credentials come from env vars so nothing is hard-coded:
 *   SITE_USER     — username (defaults to "qalara" if unset)
 *   SITE_PASSWORD — shared password (REQUIRED to enable the gate)
 *
 * Behaviour:
 *   - If SITE_PASSWORD is set, every request must carry matching Basic Auth
 *     credentials or it gets a 401 with a browser login prompt.
 *   - If SITE_PASSWORD is NOT set, the gate is disabled (open access). This
 *     keeps local dev frictionless — but it MUST be set in any deployed
 *     environment, or the portal is public.
 */

// Constant-time string comparison to avoid leaking length/content via timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function middleware(req: NextRequest) {
  const expectedPass = process.env.SITE_PASSWORD;

  // Gate disabled when no password configured (local dev convenience).
  if (!expectedPass) return NextResponse.next();

  const expectedUser = process.env.SITE_USER || "qalara";
  const header = req.headers.get("authorization");

  if (header?.startsWith("Basic ")) {
    const encoded = header.slice("Basic ".length);
    let decoded = "";
    try {
      decoded = atob(encoded);
    } catch {
      decoded = "";
    }
    const sep = decoded.indexOf(":");
    if (sep !== -1) {
      const user = decoded.slice(0, sep);
      const pass = decoded.slice(sep + 1);
      // Evaluate both comparisons so timing doesn't reveal which one failed.
      const userOk = safeEqual(user, expectedUser);
      const passOk = safeEqual(pass, expectedPass);
      if (userOk && passOk) return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Qalara Leads Portal", charset="UTF-8"',
    },
  });
}

// Run on everything except Next internals and static assets.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

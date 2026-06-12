import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Same-origin image proxy for the moodboard PDF export.
 *
 * jsPDF needs raw image bytes, but the buyer-site images are cross-origin and
 * almost never send CORS headers — fetching them from the browser fails. The
 * proxy fetches server-side and streams the bytes back from our own origin.
 * The route sits behind the portal's Basic-auth middleware like every API.
 */

const MAX_BYTES = 8 * 1024 * 1024; // refuse anything over 8 MB

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get("src") ?? "";
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return NextResponse.json({ error: "Invalid src" }, { status: 400 });
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; QalaraLMS/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream ${res.status}` },
        { status: 502 }
      );
    }
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) {
      return NextResponse.json({ error: "Not an image" }, { status: 415 });
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }
    return new NextResponse(buf, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}

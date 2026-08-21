import { NextRequest, NextResponse } from "next/server";
import { replaceSegmentLeads } from "@/lib/leads";
import { readLeadsSheet } from "@/lib/google-sheets";
import { getSegment, segmentSpreadsheetId, sheetOptionsFor } from "@/lib/segments";

// googleapis needs the Node.js runtime (not edge); allow time for a full reload.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const segmentKey = req.nextUrl.searchParams.get("segment") ?? "engagement";
  const segment = getSegment(segmentKey);

  if (!segment) {
    return NextResponse.json(
      { error: `Unknown segment "${segmentKey}".` },
      { status: 400 }
    );
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json(
      {
        message:
          "Google Sheets sync isn't configured yet. Set GOOGLE_SERVICE_ACCOUNT_JSON to enable it.",
        synced: 0,
        removed: 0,
      },
      { status: 200 }
    );
  }

  const spreadsheetId = segmentSpreadsheetId(segment);
  if (!spreadsheetId) {
    return NextResponse.json(
      {
        message: `No Google Sheet linked for "${segment.label}" yet. Set ${segment.envVars[0]} to enable sync for this segment.`,
        synced: 0,
        removed: 0,
      },
      { status: 200 }
    );
  }

  try {
    // 1. Read the segment's sheet — Customers reads a specific tab within a
    // shared workbook, with its own header names (see lib/segments.ts).
    const { sheetTitle, rows, unknownHeaders, missingHeaders } =
      await readLeadsSheet(spreadsheetId, sheetOptionsFor(segment));

    // 2. Safety guard: never wipe a segment from an empty/unreadable sheet.
    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: `The sheet "${sheetTitle}" returned 0 data rows. Aborting to protect existing data — nothing was changed.`,
        },
        { status: 422 }
      );
    }

    // 3. Safely replace just this segment's rows (watermark insert-then-delete).
    const { inserted, removed } = await replaceSegmentLeads(segment.key, rows);

    // 4. Build a helpful message, including any column mismatches.
    const warnings: string[] = [];
    if (missingHeaders.length > 0) {
      warnings.push(
        `${missingHeaders.length} expected column(s) not found (${missingHeaders
          .slice(0, 3)
          .join(", ")}${missingHeaders.length > 3 ? "…" : ""})`
      );
    }
    if (unknownHeaders.length > 0) {
      warnings.push(
        `${unknownHeaders.length} unrecognised column(s) ignored (${unknownHeaders
          .slice(0, 3)
          .join(", ")}${unknownHeaders.length > 3 ? "…" : ""})`
      );
    }

    const message =
      `Synced ${inserted} ${segment.label} from Google Sheets, replaced ${removed} previous rows.` +
      (warnings.length ? ` Note: ${warnings.join("; ")}.` : "");

    return NextResponse.json({ message, synced: inserted, removed });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Sync failed for an unknown reason.",
      },
      { status: 500 }
    );
  }
}

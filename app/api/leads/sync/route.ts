import { NextResponse } from "next/server";
import { replaceAllLeads } from "@/lib/leads";
import { readLeadsSheet } from "@/lib/google-sheets";

// googleapis needs the Node.js runtime (not edge); allow time for a full reload.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  // Not configured yet — keep the friendly placeholder behaviour.
  if (
    !process.env.GOOGLE_SHEETS_SPREADSHEET_ID ||
    !process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  ) {
    return NextResponse.json(
      {
        message:
          "Google Sheets sync isn't configured yet. Set GOOGLE_SHEETS_SPREADSHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON to enable it.",
        synced: 0,
        removed: 0,
      },
      { status: 200 }
    );
  }

  try {
    // 1. Read the sheet.
    const { sheetTitle, rows, unknownHeaders, missingHeaders } =
      await readLeadsSheet();

    // 2. Safety guard: never wipe the DB from an empty/unreadable sheet.
    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            `The sheet "${sheetTitle}" returned 0 data rows. Aborting to protect existing data — nothing was changed.`,
        },
        { status: 422 }
      );
    }

    // 3. Safely replace all leads (watermark insert-then-delete).
    const { inserted, removed } = await replaceAllLeads(rows);

    // 4. Build a helpful message, including any column mismatches.
    const warnings: string[] = [];
    if (missingHeaders.length > 0) {
      warnings.push(
        `${missingHeaders.length} expected column(s) not found in the sheet (${missingHeaders
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
      `Synced ${inserted} leads from Google Sheets, replaced ${removed ?? 0} previous rows.` +
      (warnings.length ? ` Note: ${warnings.join("; ")}.` : "");

    return NextResponse.json({
      message,
      synced: inserted,
      removed: removed ?? 0,
    });
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

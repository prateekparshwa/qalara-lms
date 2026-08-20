import { NextRequest, NextResponse } from "next/server";
import { getLeadById } from "@/lib/leads";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET a single lead by id — used to auto-open a buyer's dossier when
 * arriving from the directory-wide search (?pickId=). */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid lead id." }, { status: 400 });
  }
  const lead = await getLeadById(id);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }
  return NextResponse.json({ data: lead });
}

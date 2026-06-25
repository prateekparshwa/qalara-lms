import { NextRequest, NextResponse } from "next/server";
import { getLeads } from "@/lib/leads";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const format = sp.get("format") ?? "csv";

  try {
    // Fetch ALL matching rows. PostgREST caps each response at 1000 rows
    // regardless of the requested limit, so page through in 1000-row chunks
    // until we've collected every match (a short page means we're done).
    const baseParams = {
      segment: sp.get("segment") ?? undefined,
      q: sp.get("q") ?? "",
      org: sp.get("org") ?? undefined,
      email: sp.get("email") ?? undefined,
      website: sp.get("website") ?? undefined,
      country: sp.get("country") ?? undefined,
      buyer_type: sp.get("buyer_type") ?? undefined,
      classification: sp.get("classification") ?? undefined,
      am: sp.get("am") ?? undefined,
      unassigned: sp.get("unassigned") ?? undefined,
      confidence: sp.get("confidence") ?? undefined,
      org_scale: sp.get("org_scale") ?? undefined,
      india: sp.get("india") ?? undefined,
    };

    const PAGE = 1000;
    const all: Awaited<ReturnType<typeof getLeads>>["data"] = [];
    let total = Infinity;
    for (let page = 1; all.length < total; page++) {
      const res = await getLeads({ ...baseParams, page, limit: PAGE });
      total = res.total;
      if (res.data.length === 0) break;
      all.push(...res.data);
      if (res.data.length < PAGE) break;
    }

    const rows = all.map((lead) => ({
      Organization: lead.organization ?? "",
      "Full Name": lead.full_name ?? "",
      Designation: lead.designation ?? "",
      Phone: lead.phone ?? "",
      Email: lead.email ?? "",
      Website: lead.website ?? "",
      Country: lead.country ?? "",
      Address: lead.address ?? "",
      "Buyer Type": lead.buyer_type ?? "",
      Categories: lead.categories ?? "",
      "Employee Size": lead.employee_size ?? "",
      "Org Scale": lead.org_scale ?? "",
      "Brand Description": lead.brand_description ?? "",
      "Materials Dealt": lead.materials_dealt ?? "",
      "Customers & Markets": lead.customers_and_markets ?? "",
      "Revenue Turnover": lead.revenue_turnover ?? "",
      Competitors: lead.competitors ?? "",
      "Target Audience": lead.target_audience ?? "",
      "Store Count": lead.store_count ?? "",
      "Import Countries": lead.import_countries ?? "",
      "Price Points": lead.price_points ?? "",
      "Imports From India": lead.imports_from_india ?? "",
      "LinkedIn URL": lead.linkedin_url ?? "",
      "LinkedIn Followers": lead.linkedin_followers ?? "",
      "Instagram Handle": lead.instagram_handle ?? "",
      "Instagram Followers": lead.instagram_followers ?? "",
      "Social Media Activity": lead.social_media_activity ?? "",
      "First Contact Date": lead.first_contact_date ?? "",
      "Last Contact Date": lead.last_contact_date ?? "",
      "Current AM": lead.current_am ?? "",
      "Last Qalara Contact": lead.last_qalara_contact ?? "",
      "Last Email Subject": lead.last_email_subject ?? "",
      "Email Contact Summary": lead.email_contact_summary ?? "",
      "Buyer Classification": lead.buyer_classification ?? "",
      "Website Confidence": lead.website_confidence ?? "",
      Source: lead.source ?? "",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Leads");

    if (format === "xlsx") {
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      return new NextResponse(buf, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="qalara-leads-${Date.now()}.xlsx"`,
        },
      });
    } else {
      const csv = XLSX.utils.sheet_to_csv(ws);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="qalara-leads-${Date.now()}.csv"`,
        },
      });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

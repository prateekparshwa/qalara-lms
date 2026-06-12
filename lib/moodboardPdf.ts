/**
 * Client-side PDF export of a buyer moodboard (jsPDF, dynamically imported).
 *
 * Mirrors the on-screen editorial board: masthead, hero image, image grid
 * with labels, brand quote panel, named color palette, voice keywords and
 * collections. Cross-origin buyer-site images are pulled through our
 * /api/enrich/moodboard/image proxy and cover-cropped via canvas.
 */

export interface MoodboardPdfData {
  organization: string | null;
  website: string | null;
  brand: {
    title: string | null;
    description: string | null;
    slogan: string | null;
    colors: { hex: string; name?: string }[];
    logos: { url: string }[];
  } | null;
  images: { src: string; alt: string | null }[];
  screenshot: string | null;
  editorial: {
    tagline: string | null;
    aesthetic: string | null;
    voiceKeywords: string[];
    collections: string[];
    palette: { hex: string; name: string }[];
  } | null;
  fetchedAt: string;
}

/** Fetch an image via the proxy and cover-crop it to w×h (CSS px) as JPEG. */
async function loadCropped(
  src: string,
  w: number,
  h: number
): Promise<string | null> {
  try {
    const res = await fetch(
      `/api/enrich/moodboard/image?src=${encodeURIComponent(src)}`
    );
    if (!res.ok) return null;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });
      // Render at 2x for print sharpness.
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      // object-fit: cover
      const srcRatio = img.width / img.height;
      const dstRatio = w / h;
      let sx = 0,
        sy = 0,
        sw = img.width,
        sh = img.height;
      if (srcRatio > dstRatio) {
        sw = img.height * dstRatio;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / dstRatio;
        sy = (img.height - sh) / 4; // bias toward the top (faces/headers)
      }
      ctx.fillStyle = "#f4f4f5";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.82);
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  return [
    parseInt(m.slice(0, 2), 16),
    parseInt(m.slice(2, 4), 16),
    parseInt(m.slice(4, 6), 16),
  ];
}

/** Pick black or white text for a given background color. */
function contrastText(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 150 ? [24, 24, 27] : [250, 250, 249];
}

export async function downloadMoodboardPdf(
  data: MoodboardPdfData
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const width = pageW - margin * 2;
  let y = margin;

  const ensure = (h: number) => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const org =
    data.brand?.title || data.organization || "Buyer moodboard";
  const palette = data.editorial?.palette?.length
    ? data.editorial.palette
    : (data.brand?.colors ?? []).map((c) => ({
        hex: c.hex,
        name: c.name ?? c.hex,
      }));
  const accent = palette[0]?.hex ?? "#18181b";

  // ── Masthead ────────────────────────────────────────────────────────────
  doc.setFont("times", "normal");
  doc.setFontSize(34);
  doc.setTextColor(24);
  doc.text(doc.splitTextToSize(org.toUpperCase(), width), margin, y + 26);
  y += 38;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120);
  const sub = [
    "BRAND MOODBOARD",
    data.editorial?.aesthetic?.toUpperCase(),
    data.website?.replace(/^https?:\/\/(www\.)?/i, ""),
  ]
    .filter(Boolean)
    .join("   ·   ");
  doc.text(sub, margin, y + 8);
  y += 16;
  doc.setDrawColor(24);
  doc.setLineWidth(1.5);
  doc.line(margin, y, margin + width, y);
  y += 14;

  // ── Images: hero + grid (or screenshot fallback) ───────────────────────
  const imgs = data.images.slice(0, 10);
  if (imgs.length > 0) {
    const heroH = 200;
    const hero = await loadCropped(imgs[0].src, width, heroH);
    if (hero) {
      ensure(heroH + 8);
      doc.addImage(hero, "JPEG", margin, y, width, heroH);
      if (imgs[0].alt) {
        doc.setFillColor(24, 24, 27);
        doc.rect(margin + 8, y + heroH - 22, Math.min(imgs[0].alt.length * 4.4 + 12, width - 16), 14, "F");
        doc.setTextColor(245);
        doc.setFontSize(7);
        doc.text(imgs[0].alt.toUpperCase().slice(0, 60), margin + 14, y + heroH - 12.5);
      }
      y += heroH + 10;
    }

    const rest = imgs.slice(1, 10);
    const cols = 3;
    const gap = 8;
    const cellW = (width - gap * (cols - 1)) / cols;
    const cellH = cellW;
    const loaded = await Promise.all(
      rest.map((i) => loadCropped(i.src, cellW, cellH))
    );
    let col = 0;
    for (let i = 0; i < rest.length; i++) {
      const dataUrl = loaded[i];
      if (!dataUrl) continue;
      if (col === 0) ensure(cellH + gap);
      const x = margin + col * (cellW + gap);
      doc.addImage(dataUrl, "JPEG", x, y, cellW, cellH);
      if (rest[i].alt) {
        doc.setFillColor(24, 24, 27);
        doc.rect(x + 5, y + cellH - 17, Math.min(rest[i].alt!.length * 3.6 + 10, cellW - 10), 11, "F");
        doc.setTextColor(245);
        doc.setFontSize(6);
        doc.text(rest[i].alt!.toUpperCase().slice(0, 38), x + 10, y + cellH - 9.5);
      }
      col++;
      if (col === cols) {
        col = 0;
        y += cellH + gap;
      }
    }
    if (col !== 0) y += cellH + gap;
    y += 4;
  } else if (data.screenshot) {
    const ssH = 320;
    const ss = await loadCropped(data.screenshot, width, ssH);
    if (ss) {
      ensure(ssH + 8);
      doc.addImage(ss, "JPEG", margin, y, width, ssH);
      y += ssH + 10;
    }
  }

  // ── Quote panel ─────────────────────────────────────────────────────────
  const tagline = data.editorial?.tagline ?? data.brand?.slogan;
  if (tagline) {
    const lines = doc.splitTextToSize(`“${tagline}”`, width - 64);
    const boxH = 46 + lines.length * 18;
    ensure(boxH + 8);
    const [r, g, b] = hexToRgb(accent);
    doc.setFillColor(r, g, b);
    doc.rect(margin, y, width, boxH, "F");
    const [tr, tg, tb] = contrastText(accent);
    doc.setTextColor(tr, tg, tb);
    doc.setFont("times", "italic");
    doc.setFontSize(15);
    doc.text(lines, margin + 32, y + 30);
    if (data.editorial?.voiceKeywords?.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(
        data.editorial.voiceKeywords
          .map((k) => k.toUpperCase())
          .join("   ·   "),
        margin + 32,
        y + boxH - 16
      );
    }
    y += boxH + 14;
  }

  // ── Palette ─────────────────────────────────────────────────────────────
  if (palette.length > 0) {
    ensure(96);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("C O L O R   P A L E T T E", margin, y + 6);
    y += 14;
    const gap = 8;
    const swW = (width - gap * (palette.length - 1)) / palette.length;
    const swH = 64;
    palette.forEach((c, i) => {
      const x = margin + i * (swW + gap);
      const [r, g, b] = hexToRgb(c.hex);
      doc.setFillColor(r, g, b);
      doc.rect(x, y, swW, swH, "F");
      const [tr, tg, tb] = contrastText(c.hex);
      doc.setTextColor(tr, tg, tb);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(c.name, x + 8, y + swH - 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(c.hex.toUpperCase(), x + 8, y + swH - 9);
    });
    y += swH + 16;
  }

  // ── Collections ────────────────────────────────────────────────────────
  if (data.editorial?.collections?.length) {
    ensure(44);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("C O L L E C T I O N S   &   L I N E S", margin, y + 6);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40);
    doc.text(
      doc.splitTextToSize(data.editorial.collections.join("   ·   "), width),
      margin,
      y + 4
    );
    y += 22;
  }

  // ── About ──────────────────────────────────────────────────────────────
  if (data.brand?.description) {
    const lines = doc.splitTextToSize(data.brand.description, width).slice(0, 6);
    ensure(lines.length * 11 + 24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("A B O U T", margin, y + 6);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60);
    doc.text(lines, margin, y + 4);
    y += lines.length * 11 + 10;
  }

  // ── Footer ─────────────────────────────────────────────────────────────
  const built = new Date(data.fetchedAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(margin, pageH - 34, margin + width, pageH - 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(
    `Source: ${data.website ?? "buyer website"} · Imagery and colors extracted from the official site · Built ${built} · Qalara Buyer Intelligence`,
    margin,
    pageH - 22
  );

  const safe = org.replace(/[^a-z0-9]+/gi, "_").slice(0, 40) || "buyer";
  doc.save(`${safe}_moodboard.pdf`);
}

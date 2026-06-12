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
  images: { src: string; alt: string | null; label?: string | null }[];
  screenshot: string | null;
  editorial: {
    quote: { text: string; type: "slogan" | "essence" } | null;
    dateline: string | null;
    aesthetic: string | null;
    voiceKeywords: string[];
    programs: string[];
    palette: { hex: string; name: string }[];
    displaySample: string | null;
  } | null;
  typography: {
    display: { name: string | null; category: string | null };
    text: { name: string | null; category: string | null };
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
  const lum = (hex: string) => {
    const [r, g, b] = hexToRgb(hex);
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };
  const accent = palette.filter((c) => lum(c.hex) <= 215)[0]?.hex ?? "#18181b";
  const label = (img: { alt: string | null; label?: string | null }) =>
    img.label ?? img.alt;

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
    data.editorial?.dateline?.toUpperCase() ??
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
      const heroLabel = label(imgs[0]);
      if (heroLabel) {
        doc.setFillColor(24, 24, 27);
        doc.rect(margin + 8, y + heroH - 22, Math.min(heroLabel.length * 4.4 + 12, width - 16), 14, "F");
        doc.setTextColor(245);
        doc.setFontSize(7);
        doc.text(heroLabel.toUpperCase().slice(0, 60), margin + 14, y + heroH - 12.5);
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
      const cellLabel = label(rest[i]);
      if (cellLabel) {
        doc.setFillColor(24, 24, 27);
        doc.rect(x + 5, y + cellH - 17, Math.min(cellLabel.length * 3.6 + 10, cellW - 10), 11, "F");
        doc.setTextColor(245);
        doc.setFontSize(6);
        doc.text(cellLabel.toUpperCase().slice(0, 38), x + 10, y + cellH - 9.5);
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

  // ── Quote panel — REAL brand words only (MOODBOARD.md §3) ───────────────
  const quote =
    data.editorial?.quote ??
    (data.brand?.slogan
      ? { text: data.brand.slogan, type: "slogan" as const }
      : null);
  if (quote) {
    const lines = doc.splitTextToSize(`“${quote.text}”`, width - 64);
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
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(
      quote.type === "slogan" ? "SLOGAN" : "BRAND ESSENCE",
      margin + 32,
      y + boxH - 16
    );
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

  // ── Typography & voice ─────────────────────────────────────────────────
  // jsPDF can't embed the buyer's woff2 files, so samples render in a serif/
  // sans stand-in matching each face's category, labeled with the real name.
  if (data.typography?.display.name || data.typography?.text.name) {
    ensure(110);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("T Y P O G R A P H Y   &   V O I C E", margin, y + 6);
    y += 14;
    const gap = 8;
    const colW = (width - gap) / 2;
    const boxH = 84;
    const faces: ["Display" | "Text", { name: string | null; category: string | null } | undefined][] = [
      ["Display", data.typography?.display],
      ["Text", data.typography?.text],
    ];
    faces.forEach(([label, face], i) => {
      const x = margin + i * (colW + gap);
      doc.setDrawColor(220);
      doc.setLineWidth(0.75);
      doc.rect(x, y, colW, boxH);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(
        `${label.toUpperCase()}${face?.name ? ` · ${face.name.toUpperCase()}` : ""}`,
        x + 12,
        y + 16
      );
      const serif = !!face?.category && /serif/i.test(face.category) && !/sans/i.test(face.category);
      doc.setFont(serif ? "times" : "helvetica", "normal");
      doc.setFontSize(label === "Display" ? 24 : 17);
      doc.setTextColor(24);
      doc.text(label === "Display" ? "Aa Bb Cc" : "Aa Bb Cc 0123456789", x + 12, y + 46);
      if (label === "Display" && data.editorial?.displaySample) {
        doc.setFont(serif ? "times" : "helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(90);
        doc.text(
          doc.splitTextToSize(data.editorial.displaySample, colW - 24).slice(0, 2),
          x + 12,
          y + 62
        );
      }
      if (label === "Text" && data.editorial?.voiceKeywords?.length) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(90);
        doc.text(
          data.editorial.voiceKeywords.map((k) => k.toUpperCase()).join("  ·  "),
          x + 12,
          y + boxH - 14
        );
      }
    });
    y += boxH + 16;
  }

  // ── Programs & lines (own sub-brands / memberships, MOODBOARD.md §4) ────
  if (data.editorial?.programs?.length) {
    ensure(44);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("P R O G R A M S   &   L I N E S", margin, y + 6);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40);
    const progLines = doc.splitTextToSize(
      data.editorial.programs.join("   ·   "),
      width
    );
    doc.text(progLines, margin, y + 4);
    y += progLines.length * 12 + 12;
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

// The drawing set: every sheet in sheets/ order, one PDF page each.

import { buildIndex } from "./model.ts";
import { layoutSheet, SHEET } from "./ladder.ts";
import { pdfDocument } from "./pdf.ts";
import { drawSheet } from "./sheetDraw.ts";
import type { Project } from "./types.ts";

export function printSet(p: Project): Uint8Array {
  const ix = buildIndex(p);
  const pages = p.sheets.map((s) => ({ w: SHEET.w, h: SHEET.h, items: drawSheet(p, s, layoutSheet(p, s, ix)) }));
  const title = [p.sepia.drawing, p.sepia.project].filter(Boolean).join(" ");
  return pdfDocument(pages, title || "sepia drawing set");
}

/** The default file name: drawing number and revision ("LS1-E-A.pdf",
 * "LS1-E-B-draft.pdf"). */
export function printName(p: Project): string {
  const base = (p.sepia.drawing ?? "drawings").replace(/[^A-Za-z0-9._-]+/g, "_");
  return `${base}-${p.revision.rev}${p.revision.issued ? "" : "-draft"}.pdf`;
}

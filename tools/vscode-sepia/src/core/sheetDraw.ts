// A whole sheet as primitives: the frame and title block (from sepia.json,
// git and the sheet list), then the ladder (from core/ladder.ts). The editor
// and the PDF both draw exactly this.

import { INK, Pen, RED, type Prim } from "./draw.ts";
import { SHEET, type LadderLayout } from "./ladder.ts";
import type { Project, SheetFile } from "./types.ts";

const W = SHEET.w, H = SHEET.h, M = SHEET.margin, TH = SHEET.titleH;
const THIN = { width: 1.3 };

/** A built-in symbol about (0,0), its ports where core/symbols.ts says. */
export function drawSymbol(pen: Pen, symbol: string): void {
  const s = THIN;
  switch (symbol) {
    case "nema/contact-no":
    case "nema/contact-nc":
    case "nema/ol-nc":
      pen.line(-25, 0, -6, 0, s);
      pen.line(6, 0, 25, 0, s);
      pen.line(-6, -10, -6, 10, s);
      pen.line(6, -10, 6, 10, s);
      if (symbol !== "nema/contact-no") pen.line(-11, 11, 11, -11, s);
      return;
    case "nema/selector-no":
      pen.line(-25, 0, -11, 0, s);
      pen.line(11, 0, 25, 0, s);
      pen.circle(-8, 0, 3, { s });
      pen.circle(8, 0, 3, { s });
      pen.line(-12, -7, 12, -7, s);
      return;
    case "nema/coil":
      pen.line(-25, 0, -12, 0, s);
      pen.line(12, 0, 25, 0, s);
      pen.circle(0, 0, 12, { s });
      return;
    case "plc/di":
    case "plc/do":
      pen.rect(-35, -12, 70, 24, { s });
      return;
    default:
      pen.rect(-25, -10, 50, 20, { s: { width: 1, dash: [3, 3] } });
      pen.text(0, 4, "?", { size: 9, anchor: "middle" });
  }
}

function drawFrame(pen: Pen, p: Project, title: string, index: number, count: number): void {
  const s = p.sepia;
  const rev = p.revision;
  const y0 = H - M - TH;
  const x = [M, M + 430, M + 960, M + 1210, M + 1450, W - M];
  const head = { size: 8 };
  const body = { size: 12 };
  const small = { size: 9 };

  pen.rect(M / 2, M / 2, W - M, H - M, { s: { width: 1 } });
  pen.rect(M, M, W - 2 * M, H - 2 * M, { s: { width: 2 } });
  // Zones: numbers right to left, letters bottom to top (ASME Y14.1).
  const zx = 8, zy = 4;
  for (let i = 0; i < zx; i++) {
    const cx = M + ((i + 0.5) * (W - 2 * M)) / zx;
    pen.text(cx, M - 8, String(zx - i), { size: 11, anchor: "middle" });
    pen.text(cx, H - M + 18, String(zx - i), { size: 11, anchor: "middle" });
    if (i) {
      const lx = M + (i * (W - 2 * M)) / zx;
      pen.line(lx, M / 2, lx, M, THIN);
      pen.line(lx, H - M, lx, H - M / 2, THIN);
    }
  }
  for (let i = 0; i < zy; i++) {
    const cy = M + ((i + 0.5) * (H - 2 * M)) / zy;
    pen.text(M / 2 + 12, cy + 4, "DCBA"[i], { size: 11, anchor: "middle" });
    pen.text(W - M / 2 - 12, cy + 4, "DCBA"[i], { size: 11, anchor: "middle" });
    if (i) {
      const ly = M + (i * (H - 2 * M)) / zy;
      pen.line(M / 2, ly, M, ly, THIN);
      pen.line(W - M, ly, W - M / 2, ly, THIN);
    }
  }

  // Title strip.
  pen.rect(M, y0, W - 2 * M, TH, { s: { width: 2 } });
  for (const cx of x.slice(1, -1)) pen.line(cx, y0, cx, H - M, THIN);

  // Revisions.
  pen.text(x[0] + 8, y0 + 16, "REV", head);
  pen.text(x[0] + 50, y0 + 16, "DATE", head);
  pen.text(x[0] + 150, y0 + 16, "DESCRIPTION", head);
  pen.line(x[0], y0 + 22, x[1], y0 + 22, THIN);
  const rows = [...rev.history.slice(-3), ...(rev.issued ? [] : [{ rev: rev.rev, date: rev.date, desc: "draft" }])];
  rows.forEach((r, i) => {
    pen.text(x[0] + 8, y0 + 42 + i * 22, r.rev, body);
    pen.text(x[0] + 50, y0 + 42 + i * 22, r.date, body);
    pen.text(x[0] + 150, y0 + 42 + i * 22, r.desc, body);
  });

  // Owner, project, sheet title.
  pen.text(x[1] + 12, y0 + 28, s.company ?? "", { size: 18, bold: true });
  pen.text(x[1] + 12, y0 + 56, s.project ?? "", body);
  pen.text(x[1] + 12, y0 + 76, s.client ?? "", small);
  pen.line(x[1], y0 + 90, x[2], y0 + 90, THIN);
  pen.text(x[1] + 12, y0 + 104, "SHEET TITLE", head);
  pen.text(x[1] + 12, y0 + 134, title.toUpperCase(), { size: 22, bold: true });

  // People.
  const people: [string, string | undefined][] = [["DRAWN", s.people?.drawn], ["CHECKED", s.people?.checked], ["APPROVED", s.people?.approved]];
  people.forEach(([k, v], i) => {
    pen.text(x[2] + 10, y0 + 18 + i * 44, k, head);
    pen.text(x[2] + 10, y0 + 38 + i * 44, v || "—", body);
    if (i) pen.line(x[2], y0 + i * 44 + 2, x[3], y0 + i * 44 + 2, THIN);
  });

  // Drawing number, sheet, revision.
  pen.text(x[3] + 10, y0 + 18, "DWG NO", head);
  pen.text(x[3] + 10, y0 + 46, s.drawing ?? "", { size: 22, bold: true });
  pen.line(x[3], y0 + 60, x[4], y0 + 60, THIN);
  pen.text(x[3] + 10, y0 + 76, "SHEET", head);
  pen.text(x[3] + 10, y0 + 100, `${index} OF ${count}`, body);
  pen.line(x[3] + 120, y0 + 60, x[3] + 120, y0 + 112, THIN);
  pen.text(x[3] + 130, y0 + 76, "REV", head);
  pen.text(x[3] + 130, y0 + 100, rev.issued ? rev.rev : `${rev.rev} DRAFT`, body);
  pen.line(x[3], y0 + 112, x[4], y0 + 112, THIN);
  pen.text(x[3] + 10, y0 + 132, rev.issued ? `ISSUED ${rev.date}` : `PRINTED ${rev.date}`, small);

  // Engineer's seal.
  const sx = (x[4] + x[5]) / 2;
  pen.text(sx, y0 + 18, "ENGINEER'S SEAL", { ...head, anchor: "middle" });
  if (s.seal?.engineer) {
    pen.text(sx, y0 + TH - 30, s.seal.engineer, { ...small, anchor: "middle" });
    pen.text(sx, y0 + TH - 14, `${s.seal.state ?? ""} ${s.seal.license ?? ""}`, { ...small, anchor: "middle" });
  }

  if (!rev.issued) {
    pen.rect(x[1], y0 - 30, x[4] - x[1], 22, { s: { color: RED, width: 1.5 } });
    pen.text((x[1] + x[4]) / 2, y0 - 15, `PRELIMINARY · NOT FOR CONSTRUCTION · ${rev.rev} draft${rev.commit ? `, ${rev.commit}` : ""}`, {
      size: 12, bold: true, anchor: "middle", color: RED,
    });
  }
}

function drawLadder(pen: Pen, p: Project, L: LadderLayout): void {
  const f = L.frame;
  const railY1 = f.top - 24;
  const railY2 = f.top + (f.lines.length - 1) * f.rowH + 12;
  const classDesc = (no: string) => {
    const w = p.panel.wires?.find((w) => w.no === no);
    return (w?.class && p.sepia.wireClasses?.[w.class]?.desc) || "";
  };

  [f.railL, f.railR].forEach((rx, side) => {
    pen.tagged({ wire: L.rails[side] }, () => {
      pen.line(rx, railY1, rx, railY2, { width: 2.2 });
      pen.text(rx, railY1 - 18, L.rails[side], { size: 10, anchor: "middle" });
    });
    pen.text(rx, railY1 - 6, classDesc(L.rails[side]), { size: 9, anchor: "middle" });
  });

  f.lines.forEach((n, i) => pen.text(f.railL - 14, f.top + i * f.rowH + 4, String(n), { size: 11, anchor: "end" }));

  for (const s of L.segs) pen.tagged({ wire: s.wire }, () => pen.line(s.x1, s.y1, s.x2, s.y2, THIN));
  for (const d of L.dots) pen.tagged({ wire: d.wire }, () => pen.circle(d.x, d.y, 3.5, { fill: INK }));
  for (const l of L.labels) pen.tagged({ wire: l.wire }, () => pen.text(l.x, l.y, l.text, { size: 10, anchor: "middle" }));
  for (const st of L.stubs) {
    pen.tagged({ wire: st.wire }, () => {
      const tip = st.x + st.dir * 30;
      pen.line(st.x, st.y, tip, st.y, THIN);
      pen.path([["M", tip, st.y], ["L", tip - st.dir * 7, st.y - 4], ["L", tip - st.dir * 7, st.y + 4], ["Z"]], { fill: INK });
      pen.text(st.x + st.dir * 36, st.y + 4, st.to.join(", "), { size: 9, anchor: st.dir > 0 ? "start" : "end" });
    });
  }

  for (const pc of L.pieces) {
    const sym = pc.info?.def.symbol ?? "";
    pen.tagged({ piece: pc.ref }, () =>
      pen.at(pc.cx, pc.cy, () => {
        drawSymbol(pen, sym);
        pen.text(0, sym === "nema/coil" ? -16 : -14, pc.info?.device.tag ?? pc.ref, { size: 12, bold: true, anchor: "middle" });
        if (sym.startsWith("plc/")) pen.text(0, 4, pc.info!.def.terminals[0] ?? "", { size: 9, anchor: "middle" });
        else
          pc.ports.forEach((pt, i) =>
            pen.text(pt.x - pc.cx + (i ? -3 : 3), 12, pc.info?.def.terminals[i] ?? "", { size: 8.5, anchor: i ? "end" : "start" })
          );
        if (pc.position) pen.text(0, 19, pc.position, { size: 7.5, anchor: "middle" });
      })
    );
    // Coil cross-reference: the lines its contacts are on; N.C. overlined.
    if (pc.xref?.length) {
      let x = f.railR + 12;
      for (const r of pc.xref) {
        const t = String(r.line);
        pen.text(x, pc.cy + 4, t, { size: 10 });
        const w = t.length * 5.56;
        if (r.nc) pen.line(x, pc.cy - 6, x + w, pc.cy - 6, { width: 0.8 });
        x += w + 5;
      }
    }
  }

  for (const n of L.notes) pen.text(f.railR + 90, f.top + (n.line - f.lines[0]) * f.rowH + 4, n.text.toUpperCase(), { size: 10 });
}

export function drawSheet(p: Project, sheet: SheetFile, layout: LadderLayout): Prim[] {
  const pen = new Pen();
  const index = p.sheets.findIndex((s) => s.name === sheet.name) + 1;
  drawFrame(pen, p, sheet.sheet.title ?? sheet.name, index, p.sheets.length);
  drawLadder(pen, p, layout);
  return pen.items;
}

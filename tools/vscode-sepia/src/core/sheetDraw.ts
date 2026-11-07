// A whole sheet as primitives: the frame and title block (from sepia.json,
// git and the sheet list), then the ladder (from core/ladder.ts). The editor
// and the PDF both draw exactly this.

import { INK, Pen, RED, textWidth, type Prim, type Seg } from "./draw.ts";
import { layoutSheet, SHEET, type LadderLayout } from "./ladder.ts";
import { buildIndex, type Index } from "./model.ts";
import { generatedPages, isGenerated, setIndex as setIndexOf, type SetPage } from "./generated.ts";
import { lowestSccr } from "./check.ts";
import { drawPanelLayout, panelLayout, type PanelLayout } from "./backpanel.ts";
import { IO_BOX, IO_PORT, POWER_PORT_Y, SYMBOLS, type Port } from "./symbols.ts";
import type { Project, SheetFile } from "./types.ts";

const W = SHEET.w, H = SHEET.h, M = SHEET.margin, TH = SHEET.titleH;
const THIN = { width: 1.3 };

export type SymbolOpts = { text?: string; field?: boolean };

/** A built-in symbol about (0,0), its ports where core/symbols.ts says.
 * `n` is the piece's terminal count, which sets a power symbol's poles. */
export function drawSymbol(pen: Pen, symbol: string, n = 2, o: SymbolOpts = {}): void {
  const s = THIN;
  const box = o.field ? { width: 1.1, dash: [4, 3] } : s;
  const ports = SYMBOLS[symbol]?.ports(n) ?? [];
  const kind = SYMBOLS[symbol]?.kinds[0];
  if (kind === "power") return drawPower(pen, symbol, ports, o);
  const boxText = (text: string, w: number, size = 7) => {
    const fit = Math.min(size, (size * (w - 4)) / Math.max(1, textWidth(text, size)));
    pen.text(0, fit * 0.36, text, { size: fit, anchor: "middle" });
  };
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
    case "nema/pb-no":
      pen.line(-25, 0, -11, 0, s);
      pen.line(11, 0, 25, 0, s);
      pen.circle(-8, 0, 3, { s });
      pen.circle(8, 0, 3, { s });
      pen.line(-12, -7, 12, -7, s);
      if (symbol === "nema/pb-no") {
        pen.line(0, -7, 0, -15, s);
        pen.line(-5, -15, 5, -15, s);
      }
      return;
    case "nema/float-no":
      pen.line(-25, 0, -10, 0, s);
      pen.line(10, 0, 25, 0, s);
      pen.circle(-10, 0, 1.6, { fill: INK });
      pen.circle(10, 0, 1.6, { fill: INK });
      pen.line(-10, 0, 9, -7, s);
      pen.line(0, -3.7, 0, 7, s);
      pen.circle(0, 11, 4, { s });
      return;
    case "nema/coil":
      pen.line(-25, 0, -12, 0, s);
      pen.line(12, 0, 25, 0, s);
      pen.circle(0, 0, 12, { s });
      return;
    case "nema/cb":
      pen.line(-25, 0, -10, 0, s);
      pen.line(10, 0, 25, 0, s);
      pen.circle(-10, 0, 1.6, { fill: INK });
      pen.circle(10, 0, 1.6, { fill: INK });
      pen.path([["M", -10, -3], ["C", -6, -13, 6, -13, 10, -3]], { s });
      return;
    case "nema/fuse":
      pen.line(-25, 0, 25, 0, s);
      pen.rect(-11, -4.5, 22, 9, { s });
      return;
    case "nema/heater":
      pen.line(-25, 0, -14, 0, s);
      pen.line(14, 0, 25, 0, s);
      pen.path([["M", -14, 0], ["L", -10.5, -5], ["L", -3.5, 5], ["L", 3.5, -5], ["L", 10.5, 5], ["L", 14, 0]], { s });
      return;
    case "nema/pilot": {
      pen.line(-25, 0, -10, 0, s);
      pen.line(10, 0, 25, 0, s);
      pen.circle(0, 0, 10, { s });
      for (const a of [45, 135, 225, 315]) {
        const [c, d] = [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)];
        pen.line(12 * c, 12 * d, 16 * c, 16 * d, s);
      }
      if (o.text) pen.text(0, 3.3, o.text, { size: 9, anchor: "middle", bold: true });
      return;
    }
    case "nema/box": {
      pen.line(-25, 0, -21, 0, s);
      pen.line(21, 0, 25, 0, s);
      pen.rect(-21, -10, 42, 20, { s: box });
      // One line if it fits at 6.5, else two at 6, else shrink.
      const t = o.text ?? "";
      const words = t.split(" ");
      if (textWidth(t, 6.5) <= 38 || words.length < 2) boxText(t, 42, 6.5);
      else {
        const cut = Math.ceil(words.length / 2);
        const [a, b] = [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
        const size = Math.min(6, (6 * 38) / Math.max(textWidth(a, 6), textWidth(b, 6)));
        pen.text(0, -1.2, a, { size, anchor: "middle" });
        pen.text(0, size + 0.3, b, { size, anchor: "middle" });
      }
      return;
    }
    case "nema/terminal":
      pen.line(-7, 0, -3.5, 0, s);
      pen.line(3.5, 0, 7, 0, s);
      pen.circle(0, 0, 3.5, { s });
      return;
    case "plc/di":
    case "plc/ai":
    case "box/in":
      pen.line(-IO_PORT, 0, -IO_BOX, 0, s);
      pen.rect(-IO_BOX, -12, 2 * IO_BOX, 24, { s: box });
      return;
    case "plc/do":
    case "box/out":
      pen.line(IO_BOX, 0, IO_PORT, 0, s);
      pen.rect(-IO_BOX, -12, 2 * IO_BOX, 24, { s: box });
      return;
    default:
      pen.rect(-25, -10, 50, 20, { s: { width: 1, dash: [3, 3] } });
      pen.text(0, 4, "?", { size: 9, anchor: "middle" });
  }
}

/** Power symbols: one pole per phase, line terminals on top. */
function drawPower(pen: Pen, symbol: string, ports: Port[], o: SymbolOpts): void {
  const s = THIN;
  const tops = ports.filter((p) => p.y < 0).map((p) => p.x);
  const xs = [...new Set(ports.map((p) => p.x))];
  const x0 = Math.min(...xs), xN = Math.max(...xs), mid = (x0 + xN) / 2;
  const Y = POWER_PORT_Y;
  // Words inside a box, shrunk to fit its width.
  const label = (text: string, y: number, size = 9, w = xN - x0 + 16) => {
    const fit = Math.min(size, (size * w) / Math.max(1, textWidth(text, size)));
    pen.text(mid, y - (size - fit) * 0.36, text, { size: fit, anchor: "middle" });
  };
  const box = o.field ? { width: 1.1, dash: [4, 3] } : s;
  switch (symbol) {
    case "power/disconnect-fused":
      for (const x of xs) {
        pen.line(x, -Y, x, -18, s);
        pen.line(x, -18, x + 8, -6, s);
        pen.line(x, -6, x, Y, s);
        pen.rect(x - 4, 4, 8, 17, { s });
      }
      if (xs.length > 1) pen.line(x0 + 4, -12, xN + 4, -12, { width: 1, dash: [3, 2.5] });
      return;
    case "power/fuse":
      for (const x of xs) {
        pen.line(x, -Y, x, Y, s);
        pen.rect(x - 4, -10, 8, 20, { s });
      }
      return;
    case "power/contact":
      for (const x of xs) {
        pen.line(x, -Y, x, -5, s);
        pen.line(x - 7, -5, x + 7, -5, s);
        pen.line(x - 7, 5, x + 7, 5, s);
        pen.line(x, 5, x, Y, s);
      }
      return;
    case "power/ol":
      for (const x of xs) {
        pen.line(x, -Y, x, -10, s);
        pen.path([["M", x, -10], ["L", x + 6, -10], ["L", x + 6, 0], ["L", x - 6, 0], ["L", x - 6, 10], ["L", x, 10]], { s });
        pen.line(x, 10, x, Y, s);
      }
      return;
    case "power/vfd":
      for (const x of xs) {
        pen.line(x, -Y, x, -18, s);
        pen.line(x, 18, x, Y, s);
      }
      pen.rect(x0 - 12, -18, xN - x0 + 24, 36, { s: box });
      label(o.text ?? "VFD", 3.5);
      return;
    case "power/xfmr": {
      // Primary across the top, secondary underneath, a core between.
      const hump = (y: number, dir: number) => {
        const w = (xN - x0) / 4;
        const d: Seg[] = [["M", x0, y]];
        for (let i = 0; i < 4; i++) d.push(["C", x0 + i * w, y + dir * w * 0.7, x0 + (i + 1) * w, y + dir * w * 0.7, x0 + (i + 1) * w, y]);
        pen.path(d, { s });
      };
      for (const x of xs) {
        pen.line(x, -Y, x, -9, s);
        pen.line(x, 9, x, Y, s);
      }
      hump(-9, -1);
      pen.line(x0, -2.5, xN, -2.5, s);
      pen.line(x0, 2.5, xN, 2.5, s);
      hump(9, 1);
      return;
    }
    case "power/motor": {
      const cy = 8, r = 17;
      for (const x of tops) {
        pen.line(x, -Y, x, -20, s);
        const a = Math.atan2(-20 - cy, x - mid);
        pen.line(x, -20, mid + r * Math.cos(a), cy + r * Math.sin(a), s);
      }
      pen.circle(mid, cy, r, { s });
      label("M", cy + 4, 12);
      return;
    }
    case "power/spd":
    case "power/box": {
      for (const x of tops) pen.line(x, -Y, x, -10, s);
      pen.rect(x0 - 10, -10, xN - x0 + 20, 22, { s: box });
      label(o.text ?? (symbol === "power/spd" ? "SPD" : ""), 4.5, 8);
      if (symbol === "power/spd") {
        pen.line(mid, 12, mid, 20, s);
        pen.line(mid - 8, 20, mid + 8, 20, s);
        pen.line(mid - 5, 23, mid + 5, 23, s);
        pen.line(mid - 2, 26, mid + 2, 26, s);
      }
      return;
    }
    case "power/source":
      for (const x of xs) pen.line(x, 4, x, Y, s);
      pen.rect(x0 - 10, -18, xN - x0 + 20, 22, { s: box });
      label(o.text ?? "", -3.5, 8);
      return;
  }
}

function drawFrame(pen: Pen, p: Project, title: string, sheetNo: string): void {
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
  pen.text(x[3] + 10, y0 + 100, sheetNo, body);
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

function drawStub(pen: Pen, st: LadderLayout["stubs"][number]): void {
  const v = st.dir === "up" || st.dir === "down";
  const sg = st.dir === "left" || st.dir === "up" ? -1 : 1;
  if (!v) {
    const tip = st.x + sg * 30;
    pen.line(st.x, st.y, tip, st.y, THIN);
    pen.path([["M", tip, st.y], ["L", tip - sg * 7, st.y - 4], ["L", tip - sg * 7, st.y + 4], ["Z"]], { fill: INK });
    pen.text(st.x + sg * 36, st.y + 4, st.to, { size: 9, anchor: sg > 0 ? "start" : "end" });
    return;
  }
  const tip = st.y + sg * 22;
  pen.line(st.x, st.y, st.x, tip, THIN);
  pen.path([["M", st.x, tip], ["L", st.x - 3.5, tip - sg * 6], ["L", st.x + 3.5, tip - sg * 6], ["Z"]], { fill: INK });
  // Beside the arrowhead, to the right; neighbouring phases step down.
  pen.text(st.x + 5, tip + (sg > 0 ? 2 : -2) + sg * (st.k ?? 0) * 9, st.to, { size: 7 });
}

function drawLadder(pen: Pen, p: Project, L: LadderLayout): void {
  const f = L.frame;
  const power = f.kind === "power";
  const classDesc = (no: string) => {
    const w = p.panel.wires?.find((w) => w.no === no);
    return (w?.class && p.sepia.wireClasses?.[w.class]?.desc) || "";
  };

  if (power) {
    // Branch numbers across the top, what each branch is for underneath.
    f.lines.forEach((n, i) => pen.text(f.railL + (i + 0.5) * f.colW, f.top - 14, String(n), { size: 11, anchor: "middle" }));
    const y = f.top + f.cols * f.rowH + 4;
    for (const n of L.notes) {
      const cx = f.railL + (n.line - f.lines[0] + 0.5) * f.colW;
      wrap(n.text.toUpperCase(), 8, f.colW - 14).forEach((t, i) => pen.text(cx, y + i * 10, t, { size: 8, anchor: "middle" }));
    }
  } else {
    const railY1 = f.top - 24;
    const railY2 = f.top + (f.lines.length - 1) * f.rowH + 12;
    [f.railL, f.railR].forEach((rx, side) => {
      const wire = L.rails[side] ?? "";
      pen.tagged({ wire }, () => {
        pen.line(rx, railY1, rx, railY2, { width: 2.2 });
        pen.text(rx, railY1 - 18, wire, { size: 10, anchor: "middle" });
      });
      pen.text(rx, railY1 - 6, classDesc(wire), { size: 9, anchor: "middle" });
    });
    f.lines.forEach((n, i) => pen.text(f.railL - 14, f.top + i * f.rowH + 4, String(n), { size: 11, anchor: "end" }));
  }

  for (const s of L.segs) pen.tagged({ wire: s.wire }, () => pen.line(s.x1, s.y1, s.x2, s.y2, THIN));
  for (const d of L.dots) pen.tagged({ wire: d.wire }, () => pen.circle(d.x, d.y, 3.5, { fill: INK }));
  for (const l of L.labels)
    pen.tagged({ wire: l.wire }, () => pen.text(l.x, l.y, l.text, { size: l.size ?? 10, anchor: l.anchor ?? "middle", vertical: l.vertical }));
  for (const st of L.stubs) pen.tagged({ wire: st.wire }, () => drawStub(pen, st));

  for (const pc of L.pieces) {
    const sym = pc.info?.def.symbol ?? "";
    const dev = pc.info?.device;
    const terms = pc.info?.def.terminals ?? [];
    const tag = dev?.tag ?? pc.ref;
    // A device's rating belongs to its main (first) piece, not every contact.
    const pieceNames = Object.keys(pc.info?.part?.pieces ?? {});
    const rating = pc.info && pieceNames[0] === pc.info.name ? dev?.rating : undefined;
    pen.tagged({ piece: pc.ref }, () =>
      pen.at(pc.cx, pc.cy, () => {
        drawSymbol(pen, sym, terms.length, { text: pc.info?.def.text, field: !!dev?.field });
        if (SYMBOLS[sym]?.kinds[0] === "power") {
          // Tag and rating to the left of the first pole; terminal markings
          // beside each port.
          const x0 = Math.min(...pc.ports.map((pt) => pt.x - pc.cx));
          pen.text(x0 - 18, -1, tag, { size: 11, bold: true, anchor: "end" });
          if (rating) pen.text(x0 - 18, 10, rating, { size: 8, anchor: "end" });
          pc.ports.forEach((pt, i) => {
            const up = pt.y < pc.cy;
            pen.text(pt.x - pc.cx + 2, up ? -POWER_PORT_Y + 7 : POWER_PORT_Y - 2, terms[i] ?? "", { size: 5.5 });
          });
          return;
        }
        if (sym === "nema/terminal") {
          pen.text(0, -7, tag, { size: 7, anchor: "middle" });
          pen.text(0, 13, terms[0] ?? "", { size: 7, anchor: "middle" });
          return;
        }
        const tagY = sym === "nema/coil" || sym === "nema/pilot" ? -16 : sym === "nema/pb-no" ? -19 : -14;
        pen.text(0, tagY, tag, { size: 12, bold: true, anchor: "middle" });
        if (sym.startsWith("plc/") || sym.startsWith("box/")) pen.text(0, 4, terms[0] ?? "", { size: 9, anchor: "middle" });
        else {
          // Terminal markings under each port; under a box, clear of it.
          const ty = sym === "nema/box" ? 18 : 12;
          pc.ports.forEach((pt, i) =>
            pen.text(pt.x - pc.cx + (i ? -1 : 1), ty, terms[i] ?? "", { size: sym === "nema/box" ? 6.5 : 8.5, anchor: i ? "end" : "start" })
          );
        }
        const under = pc.position ?? rating;
        if (under) pen.text(0, sym === "nema/pilot" ? 22 : 19, under, { size: 7.5, anchor: "middle" });
      })
    );
    // Coil cross-reference: the lines its contacts are on; N.C. overlined.
    if (pc.xref?.length) {
      let x = f.railR + 12;
      for (const r of pc.xref) {
        const t = String(r.line);
        pen.text(x, pc.cy + 4, t, { size: 10 });
        const w = textWidth(t, 10);
        if (r.nc) pen.line(x, pc.cy - 6, x + w, pc.cy - 6, { width: 0.8 });
        x += w + 5;
      }
    }
  }

  if (!power)
    for (const n of L.notes) pen.text(f.railR + 90, f.top + (n.line - f.lines[0]) * f.rowH + 4, n.text.toUpperCase(), { size: 10 });
}

/** Greedy word wrap to a width, for notes under a power branch. */
function wrap(text: string, size: number, width: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    const next = line ? `${line} ${w}` : w;
    if (line && textWidth(next, size) > width) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

export function setIndex(p: Project, ix: Index = buildIndex(p)) {
  return setIndexOf(p, ix);
}

export type Rendered = { pages: Prim[][]; layout?: LadderLayout; panel?: PanelLayout };

/** A sheet as drawn: one page for a ladder or power sheet (with the layout
 * the editor hit-tests against), one or more for a generated sheet. */
export function renderSheet(p: Project, sheet: SheetFile, ix: Index = buildIndex(p)): Rendered {
  const set = setIndex(p, ix);
  const mine = set.pages.filter((sp) => sp.sheet.name === sheet.name);
  const no = (sp: SetPage | undefined) => (sp?.number === undefined ? "COVER" : `${sp.number} OF ${set.count}`);
  if (isGenerated(sheet.sheet.kind)) {
    const low = lowestSccr(p);
    const sccr = low ? `${low.ka} kA, set by ${low.tags.join(", ")}` : "";
    const draws = generatedPages(p, sheet, ix, set.pages, sccr);
    return {
      pages: draws.map((draw, i) => {
        const pen = new Pen();
        drawFrame(pen, p, mine[i]?.title ?? sheet.name, no(mine[i]));
        draw(pen);
        return pen.items;
      }),
    };
  }
  if (sheet.sheet.kind === "layout") {
    const panel = panelLayout(p, sheet, ix);
    const pen = new Pen();
    drawFrame(pen, p, sheet.sheet.title ?? sheet.name, no(mine[0]));
    drawPanelLayout(pen, panel);
    return { pages: [pen.items], panel };
  }
  const layout = layoutSheet(p, sheet, ix);
  const pen = new Pen();
  drawFrame(pen, p, sheet.sheet.title ?? sheet.name, no(mine[0]));
  drawLadder(pen, p, layout);
  return { pages: [pen.items], layout };
}

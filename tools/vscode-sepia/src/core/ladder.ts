// Ladder layout: a sheet's placements + panel.json's wires → geometry.
//
// Nothing here is stored. Each piece sits in a (line, col) cell; its symbol
// says where its ports are; each port carries one terminal, and the terminal's
// wire comes from panel.json. Wires are then drawn between the ports that
// share a wire number: along the line first, then vertical branches to the
// nearest line above that already carries the same wire. Rails are just two
// wires drawn as vertical lines.

import { buildIndex, crossRefs, type Index, type PieceInfo } from "./model.ts";
import { LADDER_COLS, SYMBOLS } from "./symbols.ts";
import type { Project, SheetFile } from "./types.ts";

/** ANSI B landscape, in hundredths of an inch. */
export const SHEET = { w: 1700, h: 1100, margin: 50, titleH: 150 };

export type Frame = {
  railL: number;
  railR: number;
  top: number;
  rowH: number;
  colW: number;
  lines: number[];
};

export type PortPos = { term: string; x: number; y: number; wire?: string };

export type PlacedPiece = {
  ref: string;
  info: PieceInfo | undefined;
  line: number;
  col: number;
  cx: number;
  cy: number;
  ports: PortPos[];
  /** Selector position label, from the device legend. */
  position?: string;
  /** Coil cross-references: lines of the device's other pieces. */
  xref?: { line: number; nc: boolean; sheet: string }[];
};

export type Seg = { x1: number; y1: number; x2: number; y2: number; wire: string };
export type Dot = { x: number; y: number; wire: string };
export type Label = { x: number; y: number; text: string; wire: string };
/** A wire leaving the sheet: an arrow and where it goes. */
export type Stub = { x: number; y: number; dir: 1 | -1; wire: string; to: string[] };

export type LadderLayout = {
  frame: Frame;
  pieces: PlacedPiece[];
  segs: Seg[];
  dots: Dot[];
  labels: Label[];
  stubs: Stub[];
  /** Right-margin note per line: the description of the output on it. */
  notes: { line: number; text: string }[];
  rails: [string, string];
};

export function frameFor(sheet: SheetFile): Frame {
  const [lo, hi] = sheet.sheet.lines ?? [1, 20];
  const lines: number[] = [];
  for (let n = lo; n <= hi; n++) lines.push(n);
  const railL = SHEET.margin + 90;
  const railR = SHEET.w - SHEET.margin - 330;
  const top = SHEET.margin + 70;
  const bottom = SHEET.h - SHEET.margin - SHEET.titleH - 70;
  return {
    railL,
    railR,
    top,
    rowH: (bottom - top) / Math.max(1, lines.length - 1),
    colW: (railR - railL) / LADDER_COLS,
    lines,
  };
}

export function cellCentre(f: Frame, line: number, col: number): { x: number; y: number } {
  const lo = f.lines[0] ?? 0;
  return { x: f.railL + (col - 0.5) * f.colW, y: f.top + (line - lo) * f.rowH };
}

/** The cell under a sheet point, clamped to the sheet's grid. */
export function cellAt(f: Frame, x: number, y: number): { line: number; col: number } {
  const lo = f.lines[0] ?? 0;
  const hi = f.lines[f.lines.length - 1] ?? lo;
  const line = Math.min(hi, Math.max(lo, Math.round((y - f.top) / f.rowH) + lo));
  const col = Math.min(LADDER_COLS, Math.max(1, Math.floor((x - f.railL) / f.colW) + 1));
  return { line, col };
}

export function layoutLadder(p: Project, sheet: SheetFile, ix: Index = buildIndex(p)): LadderLayout {
  const f = frameFor(sheet);
  const rails = (sheet.sheet.rails ?? ["", ""]) as [string, string];

  const pieces: PlacedPiece[] = [];
  for (const pl of sheet.sheet.place ?? []) {
    const info = ix.pieces.get(pl.piece);
    const { x: cx, y: cy } = cellCentre(f, pl.line, pl.col);
    const geom = info ? SYMBOLS[info.def.symbol] : undefined;
    const ports: PortPos[] = (geom?.ports ?? []).map((dx, i) => {
      const term = `${info!.device.tag}:${info!.def.terminals[i] ?? ""}`;
      return { term, x: cx + dx, y: cy, wire: ix.wireAt.get(term)?.no };
    });
    const pp: PlacedPiece = { ref: pl.piece, info, line: pl.line, col: pl.col, cx, cy, ports };
    if (info?.def.position !== undefined) pp.position = info.device.legend?.[info.def.position];
    if (info?.def.symbol === "nema/coil") pp.xref = crossRefs(ix, info);
    pieces.push(pp);
  }

  // Group this sheet's ports by wire number.
  const byWire = new Map<string, PortPos[]>();
  for (const pc of pieces) for (const pt of pc.ports) if (pt.wire) byWire.set(pt.wire, [...(byWire.get(pt.wire) ?? []), pt]);

  const segs: Seg[] = [];
  const dots: Dot[] = [];
  const labels: Label[] = [];
  const stubs: Stub[] = [];
  const lineY = (y: number) => Math.round(y * 100) / 100;

  for (const [wire, ports] of byWire) {
    const railX = wire === rails[0] ? f.railL : wire === rails[1] ? f.railR : undefined;
    if (railX !== undefined) {
      // A rail wire: every port on it runs straight across to the rail.
      for (const pt of ports) segs.push({ x1: railX, y1: pt.y, x2: pt.x, y2: pt.y, wire });
      continue;
    }
    // Rows of this wire, top to bottom; each row chained left to right.
    const rows = new Map<number, PortPos[]>();
    for (const pt of ports) rows.set(lineY(pt.y), [...(rows.get(lineY(pt.y)) ?? []), pt]);
    const ys = [...rows.keys()].sort((a, b) => a - b);
    const spans: { y: number; x1: number; x2: number }[] = [];
    for (const y of ys) {
      const row = rows.get(y)!.sort((a, b) => a.x - b.x);
      for (let i = 1; i < row.length; i++) segs.push({ x1: row[i - 1].x, y1: y, x2: row[i].x, y2: y, wire });
      let x1 = row[0].x;
      let x2 = row[row.length - 1].x;
      if (spans.length) {
        // Branch to the nearest row above that carries this wire; prefer a
        // straight drop where the x already lies inside that row's span.
        const target = spans[spans.length - 1];
        const near = row.reduce((best, pt) => (dist(pt.x, target) < dist(best.x, target) ? pt : best));
        const bx = Math.min(target.x2, Math.max(target.x1, near.x));
        if (bx !== near.x) segs.push({ x1: near.x, y1: y, x2: bx, y2: y, wire });
        segs.push({ x1: bx, y1: target.y, x2: bx, y2: y, wire });
        dots.push({ x: bx, y: target.y, wire });
        x1 = Math.min(x1, bx);
        x2 = Math.max(x2, bx);
      }
      spans.push({ y, x1, x2 });
    }
    // The number goes over the first row's run, or beside a lone port.
    const first = spans[0];
    labels.push({ x: (first.x1 + first.x2) / 2, y: first.y - 6, text: wire, wire });

    // Ends of this wire that aren't on this sheet.
    const here = new Set(ports.map((p) => p.term));
    const w = ix.wires.get(wire);
    const away = (w?.run ?? []).filter((t) => !here.has(t));
    if (away.length) {
      const last = rows.get(ys[ys.length - 1])!;
      const end = last[last.length - 1];
      const dir: 1 | -1 = end.x > (f.railL + f.railR) / 2 ? -1 : 1;
      const to = away.map((t) => {
        const tinfo = ix.terminals.get(t);
        const at = tinfo ? ix.placed.get(tinfo.piece.ref)?.[0] : undefined;
        return at ? `${t} /${at.line}` : t;
      });
      if (ports.length === 1) {
        // A lone port: the stub leaves on the side away from its piece.
        const pc = pieces.find((pc) => pc.ports.includes(end))!;
        stubs.push({ x: end.x, y: end.y, dir: end.x < pc.cx ? -1 : 1, wire, to });
      } else stubs.push({ x: end.x, y: end.y, dir, wire, to });
    }
  }

  const notes: { line: number; text: string }[] = [];
  for (const pc of pieces) {
    const sym = pc.info?.def.symbol;
    if (sym === "nema/coil") notes.push({ line: pc.line, text: pc.info!.device.desc ?? "" });
    else if (sym === "plc/di") {
      const d = pc.info!.device;
      notes.push({ line: pc.line, text: d.io?.[pc.info!.def.terminals[0]] ?? d.desc ?? "" });
    }
  }

  return { frame: f, pieces, segs, dots, labels, stubs, notes, rails };
}

function dist(x: number, s: { x1: number; x2: number }): number {
  return x < s.x1 ? s.x1 - x : x > s.x2 ? x - s.x2 : 0;
}

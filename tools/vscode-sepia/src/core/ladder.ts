// Sheet layout: a sheet's placements + panel.json's wires → geometry.
//
// Nothing here is stored. Each piece sits in a (line, col) cell; its symbol
// says where its ports are; each port carries one terminal, and the
// terminal's wire comes from panel.json. Wires are drawn between the ports
// that share a wire number.
//
// Ladder: lines are horizontal rungs. Ports on a rung are chained left to
// right, then each rung branches up to the nearest rung above that carries
// the same wire. Two wires are drawn as the rails.
//
// Power: lines are vertical branches, one pole per phase. Ports straight
// above one another drop straight down. Anything else runs on a horizontal
// track in the gap under the wire's highest port: the bus under the main
// disconnect, the motor leads where the bypass rejoins the drive output.
// Tracks are stacked by phase, L1 on top.

import { buildIndex, crossRefs, type Index, type PieceInfo } from "./model.ts";
import { DEFAULT_COLS, POLE, POWER_PORT_Y, sheetKind, SYMBOLS, type SheetKind } from "./symbols.ts";
import type { Project, SheetFile } from "./types.ts";

/** ANSI B landscape, in hundredths of an inch. */
export const SHEET = { w: 1700, h: 1100, margin: 50, titleH: 150 };

export type Frame = {
  kind: SheetKind;
  /** Ladder: the rails. Power: the left and right edges of the branches. */
  railL: number;
  railR: number;
  top: number;
  /** Ladder: rung spacing. Power: the height of one position. */
  rowH: number;
  /** Ladder: the width of one position. Power: branch spacing. */
  colW: number;
  lines: number[];
  cols: number;
};

export type PortPos = { term: string; x: number; y: number; wire?: string; piece: string };

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
export type Label = { x: number; y: number; text: string; wire: string; size?: number; anchor?: "start" | "middle" | "end" };
/** A wire leaving the sheet: an arrow and where it goes. */
export type Stub = { x: number; y: number; dir: "left" | "right" | "up" | "down"; wire: string; to: string; /** Phase, to stagger neighbouring labels. */ k?: number };

export type LadderLayout = {
  frame: Frame;
  pieces: PlacedPiece[];
  segs: Seg[];
  dots: Dot[];
  labels: Label[];
  stubs: Stub[];
  /** Per-line notes: right margin on a ladder, under the branch on power. */
  notes: { line: number; text: string }[];
  rails: string[];
};

export function frameFor(sheet: SheetFile): Frame {
  const kind = sheetKind(sheet.sheet.kind) ?? "ladder";
  const [lo, hi] = sheet.sheet.lines ?? [1, 20];
  const lines: number[] = [];
  for (let n = lo; n <= hi; n++) lines.push(n);
  const cols = sheet.sheet.cols ?? DEFAULT_COLS[kind];
  if (kind === "power") {
    const railL = SHEET.margin + 30;
    const railR = SHEET.w - SHEET.margin - 30;
    const top = SHEET.margin + 50;
    const bottom = SHEET.h - SHEET.margin - SHEET.titleH - 60;
    return { kind, railL, railR, top, rowH: (bottom - top) / cols, colW: (railR - railL) / Math.max(1, lines.length), lines, cols };
  }
  const railL = SHEET.margin + 90;
  const railR = SHEET.w - SHEET.margin - 330;
  const top = SHEET.margin + 70;
  const bottom = SHEET.h - SHEET.margin - SHEET.titleH - 70;
  return { kind, railL, railR, top, rowH: (bottom - top) / Math.max(1, lines.length - 1), colW: (railR - railL) / cols, lines, cols };
}

export function cellCentre(f: Frame, line: number, col: number): { x: number; y: number } {
  const lo = f.lines[0] ?? 0;
  if (f.kind === "power") return { x: f.railL + (line - lo + 0.5) * f.colW, y: f.top + (col - 0.5) * f.rowH };
  return { x: f.railL + (col - 0.5) * f.colW, y: f.top + (line - lo) * f.rowH };
}

/** The cell under a sheet point, clamped to the sheet's grid. */
export function cellAt(f: Frame, x: number, y: number): { line: number; col: number } {
  const lo = f.lines[0] ?? 0;
  const hi = f.lines[f.lines.length - 1] ?? lo;
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  if (f.kind === "power")
    return { line: clamp(Math.floor((x - f.railL) / f.colW) + lo, lo, hi), col: clamp(Math.floor((y - f.top) / f.rowH) + 1, 1, f.cols) };
  return { line: clamp(Math.round((y - f.top) / f.rowH) + lo, lo, hi), col: clamp(Math.floor((x - f.railL) / f.colW) + 1, 1, f.cols) };
}

/** Lay out any sheet by its kind. */
export function layoutSheet(p: Project, sheet: SheetFile, ix: Index = buildIndex(p)): LadderLayout {
  return sheetKind(sheet.sheet.kind) === "power" ? layoutPower(p, sheet, ix) : layoutLadder(p, sheet, ix);
}

function placePieces(sheet: SheetFile, f: Frame, ix: Index): PlacedPiece[] {
  const pieces: PlacedPiece[] = [];
  for (const pl of sheet.sheet.place ?? []) {
    const info = ix.pieces.get(pl.piece);
    const { x: cx, y: cy } = cellCentre(f, pl.line, pl.col);
    const geom = info ? SYMBOLS[info.def.symbol] : undefined;
    const ports: PortPos[] = (geom?.ports(info!.def.terminals.length) ?? []).map((o, i) => {
      const term = `${info!.device.tag}:${info!.def.terminals[i] ?? ""}`;
      return { term, x: cx + o.x, y: cy + o.y, wire: ix.wireAt.get(term)?.no, piece: pl.piece };
    });
    const pp: PlacedPiece = { ref: pl.piece, info, line: pl.line, col: pl.col, cx, cy, ports };
    if (info?.def.position !== undefined) pp.position = info.device.legend?.[info.def.position];
    if (info?.def.symbol === "nema/coil") pp.xref = crossRefs(ix, info);
    pieces.push(pp);
  }
  return pieces;
}

function portsByWire(pieces: PlacedPiece[]): Map<string, PortPos[]> {
  const byWire = new Map<string, PortPos[]>();
  for (const pc of pieces) for (const pt of pc.ports) if (pt.wire) byWire.set(pt.wire, [...(byWire.get(pt.wire) ?? []), pt]);
  return byWire;
}

/** Where a wire's other ends are, for its off-sheet arrow: "M101A:A1 /310",
 * or just the lines when there are many ("/300 /400"). */
function awayText(p: Project, sheet: SheetFile, ix: Index, wire: string, here: Set<string>, compact = false): string {
  // A wire that is another sheet's rail: name the sheet, not every tap on it.
  const railOn = p.sheets.flatMap((s, i) => (s !== sheet && s.name !== sheet.name && s.sheet.rails?.includes(wire) ? [i + 1] : []));
  if (railOn.length) return `${railOn.length > 1 ? "SHEETS" : "SHEET"} ${railOn.join(", ")}`;
  const away = (ix.wires.get(wire)?.run ?? []).filter((t) => !here.has(t));
  const at = away.map((t) => {
    const tinfo = ix.terminals.get(t);
    return { t, line: tinfo ? ix.placed.get(tinfo.piece.ref)?.[0]?.line : undefined };
  });
  if (at.length <= (compact ? 0 : 2)) return at.map((a) => (a.line !== undefined ? `${a.t} /${a.line}` : a.t)).join(", ");
  const lines = [...new Set(at.map((a) => a.line).filter((l) => l !== undefined))].sort((a, b) => a! - b!);
  const shown = lines.slice(0, 4).map((l) => `/${l}`).join(" ");
  return (shown || `${at.length} ends`) + (lines.length > 4 ? " …" : "");
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Junction dots: wherever three or more pieces of one wire meet. A port
 * counts as one, a segment ending there as one, a segment passing through
 * as two. A plain bend or a wire landing on a port gets no dot. */
function junctions(segs: Seg[], ports: PortPos[]): Dot[] {
  const deg = new Map<string, { x: number; y: number; wire: string; n: number }>();
  const bump = (x: number, y: number, wire: string, n: number) => {
    const k = `${wire}@${r2(x)},${r2(y)}`;
    const d = deg.get(k) ?? { x, y, wire, n: 0 };
    d.n += n;
    deg.set(k, d);
  };
  for (const s of segs) {
    bump(s.x1, s.y1, s.wire, 1);
    bump(s.x2, s.y2, s.wire, 1);
  }
  for (const p of ports) if (p.wire) bump(p.x, p.y, p.wire, 1);
  // Through-passes: a candidate point lying inside another segment of its wire.
  for (const d of deg.values()) {
    for (const s of segs) {
      if (s.wire !== d.wire) continue;
      const onH = r2(s.y1) === r2(d.y) && r2(s.y2) === r2(d.y) && Math.min(s.x1, s.x2) < d.x - 0.01 && d.x < Math.max(s.x1, s.x2) - 0.01;
      const onV = r2(s.x1) === r2(d.x) && r2(s.x2) === r2(d.x) && Math.min(s.y1, s.y2) < d.y - 0.01 && d.y < Math.max(s.y1, s.y2) - 0.01;
      if (onH || onV) d.n += 2;
    }
  }
  return [...deg.values()].filter((d) => d.n >= 3).map(({ x, y, wire }) => ({ x, y, wire }));
}

export function layoutLadder(p: Project, sheet: SheetFile, ix: Index = buildIndex(p)): LadderLayout {
  const f = frameFor(sheet);
  const rails = sheet.sheet.rails ?? ["", ""];
  const pieces = placePieces(sheet, f, ix);
  const byWire = portsByWire(pieces);

  const segs: Seg[] = [];
  const labels: Label[] = [];
  const stubs: Stub[] = [];

  for (const [wire, ports] of byWire) {
    const railX = wire === rails[0] ? f.railL : wire === rails[1] ? f.railR : undefined;
    if (railX !== undefined) {
      // A rail wire: each rung's ports chain out from the rail, nearest
      // first, so a terminal block between a load and the rail is wired
      // through rather than drawn over.
      const rows = new Map<number, PortPos[]>();
      for (const pt of ports) rows.set(r2(pt.y), [...(rows.get(r2(pt.y)) ?? []), pt]);
      for (const [y, row] of rows) {
        row.sort((a, b) => Math.abs(a.x - railX) - Math.abs(b.x - railX));
        let x = railX;
        let piece = "";
        for (const pt of row) {
          if (pt.piece !== piece) segs.push({ x1: x, y1: y, x2: pt.x, y2: y, wire });
          x = pt.x;
          piece = pt.piece;
        }
      }
      continue;
    }
    // Rows of this wire, top to bottom; each row chained left to right.
    const rows = new Map<number, PortPos[]>();
    for (const pt of ports) rows.set(r2(pt.y), [...(rows.get(r2(pt.y)) ?? []), pt]);
    const ys = [...rows.keys()].sort((a, b) => a - b);
    const spans: { y: number; x1: number; x2: number }[] = [];
    for (const y of ys) {
      const row = rows.get(y)!.sort((a, b) => a.x - b.x);
      // A terminal's two ports are one potential; its symbol carries the wire.
      for (let i = 1; i < row.length; i++)
        if (row[i].piece !== row[i - 1].piece) segs.push({ x1: row[i - 1].x, y1: y, x2: row[i].x, y2: y, wire });
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
        x1 = Math.min(x1, bx);
        x2 = Math.max(x2, bx);
      }
      spans.push({ y, x1, x2 });
    }
    // The number goes over the longest run on the first row, or beside a
    // lone port on the side away from its piece.
    const first = spans[0];
    const runs = segs.filter((sg) => sg.wire === wire && r2(sg.y1) === first.y && r2(sg.y2) === first.y);
    const longest = runs.sort((a, b) => Math.abs(b.x2 - b.x1) - Math.abs(a.x2 - a.x1))[0];
    if (longest) labels.push({ x: (longest.x1 + longest.x2) / 2, y: first.y - 6, text: wire, wire });
    else {
      const pt = rows.get(first.y)![0];
      const left = pt.x < (pieces.find((pc) => pc.ref === pt.piece)?.cx ?? pt.x);
      labels.push({ x: pt.x + (left ? -4 : 4), y: first.y - 4, text: wire, wire, anchor: left ? "end" : "start" });
    }

    // Ends of this wire that aren't on this sheet.
    const here = new Set(ports.map((p) => p.term));
    const to = awayText(p, sheet, ix, wire, here);
    if (to) {
      const last = rows.get(ys[ys.length - 1])!;
      const end = last[last.length - 1];
      let dir: Stub["dir"] = end.x > (f.railL + f.railR) / 2 ? "left" : "right";
      if (ports.length === 1) {
        // A lone port: the stub leaves on the side away from its piece.
        const pc = pieces.find((pc) => pc.ports.includes(end))!;
        dir = end.x < pc.cx ? "left" : "right";
      }
      stubs.push({ x: end.x, y: end.y, dir, wire, to });
    }
  }

  // One note per line: what the I/O point on it means, else what the load
  // at the right-hand end of it is.
  const notes: { line: number; text: string }[] = [];
  const byLine = new Map<number, PlacedPiece>();
  const ioLine = new Map<number, string>();
  for (const pc of pieces) {
    if (!pc.info) continue;
    const io = pc.info.def.symbol.startsWith("plc/") ? pc.info.device.io?.[pc.info.def.terminals[0]] : undefined;
    if (io && !ioLine.has(pc.line)) ioLine.set(pc.line, io);
    if (!NOTE_SYMBOLS.has(pc.info.def.symbol) || pc.info.device.field) continue;
    const prev = byLine.get(pc.line);
    if (!prev || pc.col > prev.col) byLine.set(pc.line, pc);
  }
  let prev = "";
  for (const line of f.lines) {
    const own = sheet.sheet.notes?.[String(line)];
    const text = own ?? ioLine.get(line) ?? byLine.get(line)?.info!.device.desc ?? "";
    // The same device on the next line says nothing new.
    if (text && (own || text !== prev)) notes.push({ line, text });
    prev = text;
  }

  const allPorts = pieces.flatMap((pc) => pc.ports);
  return { frame: f, pieces, segs, dots: junctions(segs, allPorts), labels, stubs, notes, rails };
}

/** Pieces whose device description is worth writing beside their line. */
const NOTE_SYMBOLS = new Set(["nema/coil", "nema/pilot", "nema/box", "nema/heater", "plc/di", "plc/ai"]);

/** Pieces that protect or switch a branch rather than being what it's for. */
const PROTECTIVE = new Set(["power/fuse", "power/contact", "power/ol", "power/disconnect-fused"]);

export function layoutPower(p: Project, sheet: SheetFile, ix: Index = buildIndex(p)): LadderLayout {
  const f = frameFor(sheet);
  const pieces = placePieces(sheet, f, ix);
  const byWire = portsByWire(pieces);
  const segs: Seg[] = [];
  const labels: Label[] = [];
  const stubs: Stub[] = [];

  // The gap a port opens onto: under its piece for a load terminal, above
  // it for a line terminal. Gap g lies between position g and g + 1.
  const pcOf = new Map(pieces.map((pc) => [pc.ref, pc]));
  const gapOf = (pt: PortPos) => {
    const pc = pcOf.get(pt.piece)!;
    return pt.y > pc.cy ? pc.col : pc.col - 1;
  };
  const poleOf = (pt: PortPos) => Math.round((pt.x - pcOf.get(pt.piece)!.cx + POLE) / POLE);
  const gapTop = (g: number) => f.top + (g - 0.5) * f.rowH + POWER_PORT_Y;
  const TRACK = 11;

  // Wires that need a track, by gap.
  const routed: { wire: string; ports: PortPos[]; gap: number; pole: number; x1: number; x2: number; track?: number }[] = [];
  for (const [wire, ports] of byWire) {
    const xs = ports.map((pt) => r2(pt.x));
    if (ports.length > 1 && xs.every((x) => x === xs[0])) {
      // Straight down: one vertical run joining every port.
      const sorted = [...ports].sort((a, b) => a.y - b.y);
      for (let i = 1; i < sorted.length; i++) segs.push({ x1: sorted[i - 1].x, y1: sorted[i - 1].y, x2: sorted[i].x, y2: sorted[i].y, wire });
      const a = sorted[0], b = sorted[sorted.length - 1];
      labels.push({ x: a.x + 2, y: (a.y + b.y) / 2 + 3, text: wire, wire, size: 7, anchor: "start" });
    } else if (ports.length > 1) {
      routed.push({
        wire,
        ports,
        gap: Math.min(...ports.map(gapOf)),
        pole: Math.min(...ports.map(poleOf)),
        x1: Math.min(...ports.map((pt) => pt.x)),
        x2: Math.max(...ports.map((pt) => pt.x)),
      });
    }
  }
  // Tracks: L1 above L2 above L3; wires that don't overlap share a track.
  routed.sort((a, b) => a.gap - b.gap || a.pole - b.pole || a.x1 - b.x1);
  const used = new Map<number, { x1: number; x2: number; track: number }[]>();
  for (const r of routed) {
    const taken = used.get(r.gap) ?? [];
    let k = 0;
    while (taken.some((t) => t.track === k && r.x1 < t.x2 + 12 && t.x1 < r.x2 + 12)) k++;
    taken.push({ x1: r.x1, x2: r.x2, track: k });
    used.set(r.gap, taken);
    r.track = k;
    const ty = gapTop(r.gap) + 10 + k * TRACK;
    segs.push({ x1: r.x1, y1: ty, x2: r.x2, y2: ty, wire: r.wire });
    for (const pt of r.ports) if (r2(pt.y) !== r2(ty)) segs.push({ x1: pt.x, y1: pt.y, x2: pt.x, y2: ty, wire: r.wire });
    // The number sits on the track, clear of the first drop.
    const xs = [...new Set(r.ports.map((pt) => r2(pt.x)))].sort((a, b) => a - b);
    const lx = xs.length > 1 ? (xs[0] + xs[1]) / 2 : xs[0] + 4;
    labels.push({ x: lx, y: ty - 2.5, text: r.wire, wire: r.wire, size: 7, anchor: "middle" });
  }

  // Ends of a wire that aren't on this sheet: an arrow out of the lowest
  // load terminal (down), else the highest line terminal (up).
  for (const [wire, ports] of byWire) {
    const here = new Set(ports.map((p) => p.term));
    const to = awayText(p, sheet, ix, wire, here, true);
    if (!to) continue;
    const loads = ports.filter((pt) => pt.y > pcOf.get(pt.piece)!.cy).sort((a, b) => b.y - a.y);
    const end = loads[0] ?? [...ports].sort((a, b) => a.y - b.y)[0];
    stubs.push({ x: end.x, y: end.y, dir: loads[0] ? "down" : "up", wire, to, k: poleOf(end) });
    if (ports.length === 1) labels.push({ x: end.x + 2, y: end.y + (loads[0] ? 14 : -8), text: wire, wire, size: 7, anchor: "start" });
  }

  // Under each branch: what it feeds. The sheet can say; otherwise the
  // lowest load (drive, motor, transformer…), else the lowest piece.
  const notes: { line: number; text: string }[] = [];
  const lowest = new Map<number, PlacedPiece>();
  const rank = (pc: PlacedPiece) => (PROTECTIVE.has(pc.info?.def.symbol ?? "") ? 0 : 100) + pc.col;
  for (const pc of pieces) if (!lowest.has(pc.line) || rank(pc) > rank(lowest.get(pc.line)!)) lowest.set(pc.line, pc);
  for (const line of f.lines) {
    const text = sheet.sheet.notes?.[String(line)] ?? lowest.get(line)?.info?.device.desc;
    if (text) notes.push({ line, text });
  }

  const allPorts = pieces.flatMap((pc) => pc.ports);
  return { frame: f, pieces, segs, dots: junctions(segs, allPorts), labels, stubs, notes, rails: [] };
}

function dist(x: number, s: { x1: number; x2: number }): number {
  return x < s.x1 ? s.x1 - x : x > s.x2 ? x - s.x2 : 0;
}

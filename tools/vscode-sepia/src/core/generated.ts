// Generated sheets: pages whose content comes entirely from the data. A
// sheet file only says which kind it is ({ "title": "Wire list", "kind":
// "wires" }); nothing on it is placed by hand, so it can't drift from
// panel.json.
//
//   cover      project, drawing number, sheet index, general notes, wire colours
//   bom        every part bought, grouped, with quantities and tags
//   wires      every conductor: from, to, the sleeve at each end, colour, gauge
//   terminals  each terminal strip: terminal, wire, inside and outside ends

import { conductors, schemes, type Conductor } from "./conductors.ts";
import { textWidth, type Pen } from "./draw.ts";
import { SHEET } from "./paper.ts";
import { resolvePart, type Index } from "./model.ts";
import type { Part, Project, SheetFile } from "./types.ts";

export const GENERATED = ["cover", "bom", "wires", "terminals"] as const;
export type GeneratedKind = (typeof GENERATED)[number];
export const isGenerated = (k: string | undefined): k is GeneratedKind => (GENERATED as readonly string[]).includes(k ?? "");

/** One page in the set, for numbering and the cover's index. */
export type SetPage = { sheet: SheetFile; page: number; pages: number; number?: number; title: string };

const M = SHEET.margin;
/** The drawing area inside the border, above the title strip and its stamp. */
const AREA = { x: M + 20, y: M + 24, w: SHEET.w - 2 * M - 40, bottom: SHEET.h - M - SHEET.titleH - 44 };
const ROW = 16;

type Col = { title: string; w: number; align?: "end" };

/** Text squeezed into a width: smaller first, then cut. */
function fit(text: string, size: number, w: number): { text: string; size: number } {
  if (textWidth(text, size) <= w) return { text, size };
  const s = Math.max(5.5, (size * w) / textWidth(text, size));
  if (textWidth(text, s) <= w) return { text, size: s };
  let t = text;
  while (t.length > 1 && textWidth(t + "..", s) > w) t = t.slice(0, -1);
  return { text: t + "..", size: s };
}

/** A ruled table: a bold header row, then rows. A row that is a single
 * string is a section heading across the table. */
function table(pen: Pen, x: number, y: number, cols: Col[], rows: (string[] | string)[]): void {
  const W = cols.reduce((a, c) => a + c.w, 0);
  const thin = { width: 0.5 };
  pen.rect(x, y, W, (rows.length + 1) * ROW, { s: { width: 1.2 } });
  let cx = x;
  for (const c of cols) {
    pen.text(c.align === "end" ? cx + c.w - 4 : cx + 4, y + ROW - 5, c.title, { size: 7.5, bold: true, anchor: c.align === "end" ? "end" : "start" });
    cx += c.w;
  }
  pen.line(x, y + ROW, x + W, y + ROW, { width: 1 });
  rows.forEach((r, i) => {
    const ry = y + (i + 1) * ROW;
    if (i) pen.line(x, ry, x + W, ry, thin);
    if (typeof r === "string") {
      pen.text(x + 4, ry + ROW - 5, r, { size: 8, bold: true });
      return;
    }
    let cx = x;
    cols.forEach((c, j) => {
      const f = fit(r[j] ?? "", 8, c.w - 8);
      pen.text(c.align === "end" ? cx + c.w - 4 : cx + 4, ry + ROW - 5, f.text, { size: f.size, anchor: c.align === "end" ? "end" : "start" });
      cx += c.w;
    });
  });
  cx = x;
  for (const c of cols.slice(0, -1)) {
    cx += c.w;
    pen.line(cx, y, cx, y + (rows.length + 1) * ROW, thin);
  }
}

/** Rows that fit under a heading at `top`, header row included. */
const rowsFit = (top: number) => Math.floor((AREA.bottom - top) / ROW) - 1;

function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out.length ? out : [[]];
}

/** Where a terminal is drawn: "302" or "3/302" when it's on another sheet. */
function whereDrawn(ix: Index, term: string): string {
  const info = ix.terminals.get(term);
  const at = info ? ix.placed.get(info.piece.ref)?.[0] : undefined;
  return at ? String(at.line) : "";
}

// ------------------------------------------------------------------ BOM

export type BomLine = { part: Part | undefined; id: string; qty: number; tags: string[]; field: boolean };

/** What gets bought: each device's part, or its assembly's bill of
 * materials, totalled by part. Field devices are listed apart. */
export function bom(p: Project): BomLine[] {
  const lines = new Map<string, BomLine>();
  for (const d of p.panel.devices ?? []) {
    const part = p.parts[d.part];
    const items = part?.bom?.length ? part.bom : [{ part: d.part, qty: 1 }];
    for (const it of items) {
      const key = `${d.field ? "F" : "P"}:${it.part}`;
      const line = lines.get(key) ?? { part: resolvePart(p.parts, it.part), id: it.part, qty: 0, tags: [], field: !!d.field };
      line.qty += it.qty ?? 1;
      if (!line.tags.includes(d.tag)) line.tags.push(d.tag);
      lines.set(key, line);
    }
  }
  const key = (l: BomLine) => `${l.part?.manufacturer ?? "~"} ${l.part?.catalog ?? l.id}`.toLowerCase();
  return [...lines.values()].sort((a, b) => Number(a.field) - Number(b.field) || key(a).localeCompare(key(b)));
}

function bomPages(p: Project): ((pen: Pen) => void)[] {
  const lines = bom(p);
  const cols: Col[] = [
    { title: "ITEM", w: 45, align: "end" }, { title: "QTY", w: 40, align: "end" }, { title: "MANUFACTURER", w: 140 },
    { title: "CATALOG NUMBER", w: 230 }, { title: "DESCRIPTION", w: 650 }, { title: "TAGS", w: AREA.w - 1105 },
  ];
  const rows: (string[] | string)[] = [];
  let item = 0;
  let section = "";
  for (const l of lines) {
    const s = l.field ? "FIELD DEVICES (OUTSIDE THE ENCLOSURE)" : "PANEL";
    if (s !== section) rows.push((section = s));
    rows.push([String(++item), String(l.qty), l.part?.manufacturer ?? "", l.part?.catalog ?? "—", l.part?.desc ?? l.id, l.tags.join(", ")]);
  }
  return chunk(rows, rowsFit(AREA.y)).map((page) => (pen: Pen) => table(pen, AREA.x, AREA.y, cols, page));
}

// ------------------------------------------------------------ wire list

function wirePages(p: Project, ix: Index): ((pen: Pen) => void)[] {
  const cs = conductors(p, ix);
  const cls = p.sepia.wireClasses ?? {};
  const half = (AREA.w - 30) / 2;
  const cols: Col[] = [
    { title: "WIRE", w: 52 }, { title: "FROM", w: 92 }, { title: "TO", w: 92 }, { title: "SLEEVE AT FROM", w: 100 },
    { title: "SLEEVE AT TO", w: 100 }, { title: "LINES", w: 70 }, { title: "COLOUR", w: 82 }, { title: "AWG", w: 34, align: "end" },
    { title: "", w: half - 622 },
  ];
  const row = (c: Conductor) => {
    const k = cls[c.wire.class ?? ""];
    const a = whereDrawn(ix, c.from), b = whereDrawn(ix, c.to);
    return [c.wire.no, c.from, c.to, c.markFrom, c.markTo, a === b ? a : `${a} / ${b}`, k?.color ?? "", k?.awg ? String(k.awg) : "", c.field ? "FIELD" : ""];
  };
  const per = rowsFit(AREA.y);
  return chunk(cs.map(row), per * 2).map((rows) => (pen: Pen) => {
    table(pen, AREA.x, AREA.y, cols, rows.slice(0, per));
    if (rows.length > per) table(pen, AREA.x + half + 30, AREA.y, cols, rows.slice(per));
  });
}

// ---------------------------------------------------------- terminal plan

function terminalPages(p: Project, ix: Index): ((pen: Pen) => void)[] {
  const cs = conductors(p, ix);
  const strips = [...ix.devices.values()].filter((d) =>
    Object.values(resolvePart(p.parts, d.part)?.pieces ?? {}).some((pc) => pc.symbol === "nema/terminal")
  );
  const cols: Col[] = [
    { title: "TERM", w: 45, align: "end" }, { title: "WIRE", w: 60 }, { title: "INSIDE: TO", w: 150 },
    { title: "OUTSIDE: TO", w: 150 }, { title: "LINE", w: 50 }, { title: "", w: 30 },
  ];
  const W = cols.reduce((a, c) => a + c.w, 0);
  // Each strip is a block; blocks fill columns down the page, then across.
  type Block = { title: string; rows: string[][] };
  const blocks: Block[] = strips.map((d) => {
    const terms = [...new Set(Object.values(resolvePart(p.parts, d.part)!.pieces!).filter((pc) => pc.symbol === "nema/terminal").map((pc) => pc.terminals[0]))];
    return {
      title: `${d.tag}  ${d.desc ?? ""}`.toUpperCase(),
      rows: terms.map((t) => {
        const term = `${d.tag}:${t}`;
        const on = cs.filter((c) => c.from === term || c.to === term);
        const far = (c: Conductor) => (c.from === term ? c.to : c.from);
        const inside = on.filter((c) => !c.field).map(far).join(", ");
        const outside = on.filter((c) => c.field).map(far).join(", ");
        const w = ix.wireAt.get(term)?.no ?? "";
        return [t, w, inside, outside, whereDrawn(ix, term), w ? "" : "SPARE"];
      }),
    };
  });
  const pages: ((pen: Pen) => void)[] = [];
  let draws: ((pen: Pen) => void)[] = [];
  let x = AREA.x, y = AREA.y;
  for (const b of blocks) {
    const h = (b.rows.length + 1) * ROW + 22;
    if (y + h > AREA.bottom && y > AREA.y) {
      x += W + 40;
      y = AREA.y;
      if (x + W > AREA.x + AREA.w) {
        pages.push(((ds) => (pen: Pen) => ds.forEach((d) => d(pen)))(draws));
        draws = [];
        x = AREA.x;
      }
    }
    const [bx, by] = [x, y];
    draws.push((pen) => {
      pen.text(bx, by + 12, b.title, { size: 10, bold: true });
      table(pen, bx, by + 18, cols, b.rows);
    });
    y += h + 14;
  }
  pages.push(((ds) => (pen: Pen) => ds.forEach((d) => d(pen)))(draws));
  return pages;
}

// --------------------------------------------------------------- cover

function coverPage(p: Project, ix: Index, set: SetPage[], panelSccr: string): (pen: Pen) => void {
  const s = p.sepia;
  return (pen: Pen) => {
    const x = AREA.x + 10;
    pen.text(x, AREA.y + 40, (s.project ?? "").toUpperCase(), { size: 30, bold: true });
    pen.text(x, AREA.y + 72, "ELECTRICAL DRAWINGS", { size: 16 });
    pen.text(x, AREA.y + 100, [s.drawing, s.client].filter(Boolean).join("  ·  "), { size: 12 });

    // General notes: the ones the data implies, then the project's own.
    const sc = schemes(p);
    const svc = s.service as { volts?: number; phases?: number; transformerKva?: number; transformerZPct?: number } | undefined;
    const notes: string[] = [];
    if (svc?.volts) {
      const ka = svc.transformerKva && svc.transformerZPct ? (svc.transformerKva * 1000) / (Math.sqrt(3) * svc.volts) / (svc.transformerZPct / 100) / 1000 : undefined;
      notes.push(`Supply ${svc.volts} V, ${svc.phases ?? 3} phase.` + (ka ? ` Available fault current ${ka.toFixed(1)} kA (${svc.transformerKva} kVA at ${svc.transformerZPct} %Z).` : ""));
    }
    if (panelSccr) notes.push(`Panel short-circuit current rating: ${panelSccr}.`);
    const say = (k: string) => (k === "line" ? "numbered by line" : "marked from-to (each end carries the far terminal)");
    notes.push(sc.internal === sc.field ? `All wires are ${say(sc.internal)}.` : `Wires inside the panel are ${say(sc.internal)}. Field wires are ${say(sc.field)}.`);
    notes.push(...((s.notes as string[] | undefined) ?? []));
    pen.text(x, AREA.y + 150, "GENERAL NOTES", { size: 11, bold: true });
    let ny = AREA.y + 172;
    notes.forEach((n, i) => {
      const lines = wrapText(n, 9, 640);
      pen.text(x, ny, `${i + 1}.`, { size: 9 });
      lines.forEach((l, j) => pen.text(x + 22, ny + j * 13, l, { size: 9 }));
      ny += lines.length * 13 + 6;
    });

    // Wire colours.
    const cls = Object.entries(s.wireClasses ?? {});
    const wy = Math.max(ny + 20, AREA.y + 430);
    pen.text(x, wy, "WIRE CLASSES", { size: 11, bold: true });
    table(pen, x, wy + 8, [{ title: "CLASS", w: 80 }, { title: "DESCRIPTION", w: 280 }, { title: "COLOUR", w: 110 }, { title: "AWG", w: 50, align: "end" }],
      cls.map(([k, v]) => [k, v.desc ?? "", v.color ?? "", v.awg ? String(v.awg) : ""]));

    // Sheet index.
    const ixX = AREA.x + AREA.w - 560;
    pen.text(ixX, AREA.y + 150, "SHEET INDEX", { size: 11, bold: true });
    table(pen, ixX, AREA.y + 158, [{ title: "SHEET", w: 60, align: "end" }, { title: "TITLE", w: 380 }, { title: "LINES", w: 120 }],
      set.map((sp) => [sp.number === undefined ? "—" : String(sp.number), sp.title.toUpperCase(),
        sp.page === 1 && sp.sheet.sheet.lines ? sp.sheet.sheet.lines.join("–") : ""]));
    void ix;
  };
}

function wrapText(text: string, size: number, width: number): string[] {
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

/** Every page of the set in order, numbered. A cover isn't numbered, so the
 * first schematic is sheet 1 and its line numbers can start at 100. */
export function setIndex(p: Project, ix: Index): { pages: SetPage[]; count: number } {
  const pages: SetPage[] = [];
  let n = 0;
  for (const s of p.sheets) {
    const title = s.sheet.title ?? s.name;
    const count = s.sheet.kind === "cover" ? 1 : isGenerated(s.sheet.kind) ? generatedPages(p, s, ix).length : 1;
    for (let i = 1; i <= count; i++)
      pages.push({ sheet: s, page: i, pages: count, title: count > 1 ? `${title}, ${i} of ${count}` : title, number: s.sheet.kind === "cover" ? undefined : ++n });
  }
  return { pages, count: n };
}

/** The pages of a generated sheet, each a function drawing its content
 * (the frame is drawn around it by sheetDraw.ts). */
export function generatedPages(p: Project, sheet: SheetFile, ix: Index, set: SetPage[] = [], panelSccr = ""): ((pen: Pen) => void)[] {
  switch (sheet.sheet.kind as GeneratedKind) {
    case "cover":
      return [coverPage(p, ix, set, panelSccr)];
    case "bom":
      return bomPages(p);
    case "wires":
      return wirePages(p, ix);
    case "terminals":
      return terminalPages(p, ix);
  }
  return [];
}

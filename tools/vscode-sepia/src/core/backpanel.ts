// The panel layout sheet (PNL-F11): the backpanel and the door, to scale,
// with every device where it's mounted. Sizes come from the part files
// (`mount.size_mm`); the sheet only says where things go (`din`, `duct`,
// `mount`). All positions are in mm; only the drawing scales them.

import type { DinRail, Duct, Mount, Part, PartMount, Problem, Project, SheetFile } from "./types.ts";
import { resolvePart, type Index } from "./model.ts";
import { Pen, RED, textWidth } from "./draw.ts";
import { SHEET } from "./paper.ts";

/** Drawing scales, 1:n, smallest first. */
export const SCALES = [4, 5, 8, 10, 12, 16, 20];
/** Sheet units (1/100 in) per mm at 1:1. */
const UPM = 100 / 25.4;
/** A 35 mm top-hat rail. */
export const DIN_H = 35;
/** What a part with no size is drawn as, dashed. */
const UNSIZED: [number, number, number] = [20, 80, 60];

export type MountKind = "din" | "backpanel" | "door" | "outside" | "attached";
export type Face = "backpanel" | "door";

export function mountKind(m: PartMount | undefined): MountKind | undefined {
  if (!m) return undefined;
  if (m.on) return "attached";
  if (m.din) return "din";
  if (m.door) return "door";
  if (m.outside) return "outside";
  if (m.backpanel) return "backpanel";
  return undefined;
}

/** A device's body: how it mounts and how big it is. */
export type Body = { kind?: MountKind; w: number; h: number; d: number; sized: boolean; part?: Part };

export function bodyOf(p: Project, ix: Index, tag: string): Body | undefined {
  const dev = ix.devices.get(tag);
  if (!dev) return undefined;
  const part = resolvePart(p.parts, dev.part);
  const size = part?.mount?.size_mm;
  const [w, h, d] = size ?? UNSIZED;
  return { kind: mountKind(part?.mount), w, h, d, sized: !!size, part };
}

/** A mounted device, in mm in its face's coordinates: the backpanel's
 * from the backpanel's top-left corner, the door's from the enclosure's
 * top-left corner seen from the front (outside parts can be negative). */
export type Item = Body & {
  tag: string;
  desc: string;
  partId: string;
  face: Face;
  on?: string;
  x: number;
  y: number;
  /** Its entry in the sheet's `mount`. */
  index: number;
};

/** A view on the paper: where its origin is (sheet units). */
export type View = { face: Face; ox: number; oy: number };

export type PanelLayout = {
  sheet: SheetFile;
  enclosure?: { tag: string; w: number; h: number; d: number };
  /** The backpanel's size and its offset inside the enclosure (centred). */
  backpanel?: { w: number; h: number; x: number; y: number };
  rails: DinRail[];
  ducts: Duct[];
  items: Item[];
  scale: number;
  /** Sheet units per mm at this scale. */
  k: number;
  views: Record<Face, View>;
  /** Where the parts table goes, sheet units. */
  table: { x: number; y: number; w: number; bottom: number };
  /** Mount entries that don't resolve, for the checker. */
  bad: { index: number; device: string; code: string; why: string }[];
};

const M = SHEET.margin;
const AREA = { x: M + 20, y: M + 24, w: SHEET.w - 2 * M - 40, bottom: SHEET.h - M - SHEET.titleH - 44 };
const GAP = 60;
const TABLE_W = 470;
const UNDER = 36; // view title and size under each view

/** The enclosure a layout sheet draws: its outside size and its backpanel. */
function enclosureOf(p: Project, ix: Index, tag: string | undefined): Pick<PanelLayout, "enclosure" | "backpanel"> {
  const dev = tag ? ix.devices.get(tag) : undefined;
  if (!dev) return {};
  const part = resolvePart(p.parts, dev.part);
  const size = part?.enclosure?.size_mm;
  if (!size) return {};
  const enclosure = { tag: dev.tag, w: size[0], h: size[1], d: size[2] };
  const bpPart = [part, ...(part?.bom ?? []).map((b) => resolvePart(p.parts, b.part))].find((x) => x?.panel?.size_mm);
  const bp = bpPart?.panel?.size_mm;
  const backpanel = bp ? { w: bp[0], h: bp[1], x: (size[0] - bp[0]) / 2, y: (size[1] - bp[1]) / 2 } : { w: size[0], h: size[1], x: 0, y: 0 };
  return { enclosure, backpanel };
}

export function panelLayout(p: Project, sheet: SheetFile, ix: Index): PanelLayout {
  const s = sheet.sheet;
  const { enclosure, backpanel } = enclosureOf(p, ix, s.enclosure);
  const rails = (s.din ?? []).filter((r) => r && typeof r.id === "string" && [r.x, r.y, r.len].every(Number.isFinite));
  const ducts = (s.duct ?? []).filter((d) => d && [d.x, d.y, d.w, d.h].every(Number.isFinite));
  const encW = enclosure?.w ?? 600;
  const encH = enclosure?.h ?? 800;
  const items: Item[] = [];
  const bad: PanelLayout["bad"] = [];
  const byTag = new Map<string, Item>();
  const later: [Mount, number, Body, Omit<Item, "face" | "x" | "y" | keyof Body>][] = [];

  (s.mount ?? []).forEach((m, index) => {
    const dev = m?.device ? ix.devices.get(m.device) : undefined;
    if (!dev) {
      bad.push({ index, device: m?.device ?? "", code: "mount-device", why: `no device ${m?.device ?? "(none)"} in panel.json` });
      return;
    }
    if (byTag.has(dev.tag) || later.some(([x]) => x.device === dev.tag)) {
      bad.push({ index, device: dev.tag, code: "mount-twice", why: `${dev.tag} is mounted twice` });
      return;
    }
    const body = bodyOf(p, ix, dev.tag)!;
    const base = { tag: dev.tag, desc: dev.desc ?? "", partId: dev.part, on: m.on, index };
    const at = (face: Face, x: number, y: number) => {
      const it: Item = { ...body, ...base, face, x, y };
      items.push(it);
      byTag.set(dev.tag, it);
    };
    const rail = m.on !== undefined ? rails.find((r) => r.id === m.on) : undefined;
    if (rail) at("backpanel", m.x ?? rail.x, rail.y - body.h / 2);
    else if (m.on === "door") at("door", m.x ?? 0, m.y ?? 0);
    else if (m.on === "top") at("door", m.x ?? 0, -body.h);
    else if (m.on === "left") at("door", -body.w, m.y ?? 0);
    else if (m.on === "right") at("door", encW, m.y ?? 0);
    else if (m.on !== undefined && ix.devices.has(m.on)) later.push([m, index, body, base]);
    else if (m.on !== undefined) bad.push({ index, device: dev.tag, code: "mount-on", why: `${dev.tag} is on "${m.on}", which is no rail, device, "door", "top", "left" or "right"` });
    else at("backpanel", m.x ?? 0, m.y ?? 0);
  });
  for (const [m, index, body, base] of later) {
    const host = byTag.get(m.on!);
    if (!host) {
      bad.push({ index, device: m.device, code: "mount-on", why: `${m.device} is on ${m.on}, which isn't mounted on this sheet` });
      continue;
    }
    const it: Item = { ...body, ...base, face: host.face, x: host.x + (host.w - body.w) / 2, y: host.y + host.h };
    items.push(it);
    byTag.set(it.tag, it);
  }

  // Room outside the enclosure, for what's on its top and sides.
  const ext = (f: (i: Item) => number) => Math.max(0, ...items.filter((i) => i.face === "door").map(f));
  const top = ext((i) => -i.y);
  const left = ext((i) => -i.x);
  const right = ext((i) => i.x + i.w - encW);
  const widthAt = (n: number) => ((encW + left + encW + right) * UPM) / n + GAP;
  const heightAt = (n: number) => ((top + encH) * UPM) / n + UNDER + 14;
  const room = { w: AREA.w - TABLE_W - GAP, h: AREA.bottom - AREA.y };
  const scale = s.scale && SCALES.includes(s.scale) ? s.scale : (SCALES.find((n) => widthAt(n) <= room.w && heightAt(n) <= room.h) ?? SCALES[SCALES.length - 1]);
  const k = UPM / scale;

  const encTop = AREA.y + 10 + top * k;
  const bpView: View = { face: "backpanel", ox: AREA.x + (backpanel?.x ?? 0) * k, oy: encTop + (backpanel?.y ?? 0) * k };
  const doorView: View = { face: "door", ox: AREA.x + encW * k + GAP + left * k, oy: encTop };
  const tableX = doorView.ox + (encW + right) * k + GAP;
  return {
    sheet,
    enclosure,
    backpanel,
    rails,
    ducts,
    items,
    scale,
    k,
    views: { backpanel: bpView, door: doorView },
    table: { x: tableX, y: AREA.y + 10, w: AREA.x + AREA.w - tableX, bottom: AREA.bottom },
    bad,
  };
}

// ── paper ↔ mm ──────────────────────────────────────────────────────────

export type Rect = { x: number; y: number; w: number; h: number };

/** An mm rectangle on a face, in sheet units. */
export function toSheet(L: PanelLayout, face: Face, r: Rect): Rect {
  const v = L.views[face];
  return { x: v.ox + r.x * L.k, y: v.oy + r.y * L.k, w: r.w * L.k, h: r.h * L.k };
}

/** A sheet point in a face's mm. */
export function toMm(L: PanelLayout, face: Face, sx: number, sy: number): { x: number; y: number } {
  const v = L.views[face];
  return { x: (sx - v.ox) / L.k, y: (sy - v.oy) / L.k };
}

/** Where a device would go if dropped at a sheet point: the mount op's
 * fields and its outline, or null where it can't go. A DIN part snaps to
 * the nearest rail and slides to the nearest free stretch of it; anything
 * else snaps to 5 mm and stays inside its face. */
export function snapMount(L: PanelLayout, tag: string, body: Body, sx: number, sy: number): { on?: string; x: number; y?: number; rect: Rect } | null {
  const round5 = (v: number) => Math.round(v / 5) * 5;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const { w, h } = body;
  if (body.kind === "din") {
    const mm = toMm(L, "backpanel", sx, sy);
    const near = L.rails
      .filter((r) => Math.abs(r.y - mm.y) <= Math.max(h / 2, 40) && mm.x >= r.x - w && mm.x <= r.x + r.len + w && r.len >= w)
      .sort((a, b) => Math.abs(a.y - mm.y) - Math.abs(b.y - mm.y))[0];
    if (!near) return null;
    const want = clamp(Math.round(mm.x - w / 2), near.x, near.x + near.len - w);
    const x = freeAlong(L, near, tag, w, want);
    if (x === null) return null;
    return { on: near.id, x, rect: toSheet(L, "backpanel", { x, y: near.y - h / 2, w, h }) };
  }
  if (body.kind === "backpanel" && L.backpanel) {
    const mm = toMm(L, "backpanel", sx, sy);
    const x = clamp(round5(mm.x - w / 2), 0, Math.max(0, L.backpanel.w - w));
    const y = clamp(round5(mm.y - h / 2), 0, Math.max(0, L.backpanel.h - h));
    return { x, y, rect: toSheet(L, "backpanel", { x, y, w, h }) };
  }
  if (body.kind === "door" && L.enclosure) {
    const mm = toMm(L, "door", sx, sy);
    const x = clamp(round5(mm.x - w / 2), 0, Math.max(0, L.enclosure.w - w));
    const y = clamp(round5(mm.y - h / 2), 0, Math.max(0, L.enclosure.h - h));
    return { on: "door", x, y, rect: toSheet(L, "door", { x, y, w, h }) };
  }
  return null;
}

/** The free x nearest `want` on a rail for a part `w` wide, or null. */
function freeAlong(L: PanelLayout, rail: DinRail, tag: string, w: number, want: number): number | null {
  const taken = L.items.filter((i) => i.on === rail.id && i.tag !== tag).map((i) => [i.x, i.x + i.w] as const);
  const lo = rail.x, hi = rail.x + rail.len - w;
  const free = (x: number) => x >= lo - 1e-6 && x <= hi + 1e-6 && taken.every(([a, b]) => x + w <= a + 1e-6 || x >= b - 1e-6);
  const cands = [want, ...taken.flatMap(([a, b]) => [b, a - w])].filter(free);
  if (!cands.length) return null;
  return cands.sort((a, b) => Math.abs(a - want) - Math.abs(b - want))[0];
}

// ── drawing ─────────────────────────────────────────────────────────────

const TAG = 6.5;
const RAIL_FILL = "#d6d6d6";
const DUCT_FILL = "#ececec";
const PART_FILL = "#ffffff";

/** Tags as short as they'll go: "FTB1"…"FTB8" → "FTB1–8"; CB1–4 and
 * CB6–8 → "CB1–4, 6–8". */
export function tagRun(tags: string[]): string {
  const out: string[] = [];
  let prefix: string | undefined;
  let i = 0;
  while (i < tags.length) {
    const m = /^(.*?)(\d+)$/.exec(tags[i]);
    if (!m) {
      out.push(tags[i++]);
      prefix = undefined;
      continue;
    }
    let j = i;
    while (j + 1 < tags.length) {
      const n = /^(.*?)(\d+)$/.exec(tags[j + 1]);
      if (!n || n[1] !== m[1] || Number(n[2]) !== Number(m[2]) + (j + 1 - i)) break;
      j++;
    }
    const last = /^(.*?)(\d+)$/.exec(tags[j])![2];
    const head = m[1] === prefix ? m[2] : tags[i];
    out.push(j > i ? `${head}–${last}` : head);
    prefix = m[1];
    i = j + 1;
  }
  return out.join(", ");
}

export function drawPanelLayout(pen: Pen, L: PanelLayout): void {
  const bp = L.backpanel, enc = L.enclosure;
  const R = (face: Face, r: Rect) => toSheet(L, face, r);
  const box = (r: Rect, o: Parameters<Pen["rect"]>[4]) => pen.rect(r.x, r.y, r.w, r.h, o);

  if (!enc || !bp) {
    pen.text(L.views.backpanel.ox, L.views.backpanel.oy + 20, "No enclosure: set \"enclosure\" to the enclosure's tag; its part needs enclosure.size_mm.", { size: 9, color: RED });
  } else {
    // Backpanel view, the enclosure's inside edge dashed around it.
    box(R("backpanel", { x: -bp.x, y: -bp.y, w: enc.w, h: enc.h }), { s: { width: 0.6, dash: [6, 4] } });
    box(R("backpanel", { x: 0, y: 0, w: bp.w, h: bp.h }), { s: { width: 1.5 } });
    // Door view: the enclosure from the front.
    box(R("door", { x: 0, y: 0, w: enc.w, h: enc.h }), { s: { width: 1.5 } });
    box(R("door", { x: 12, y: 12, w: enc.w - 24, h: enc.h - 24 }), { s: { width: 0.5 } });
    const under = (face: Face, title: string, size: string) => {
      const r = R(face, face === "door" ? { x: 0, y: 0, w: enc.w, h: enc.h } : { x: -bp.x, y: -bp.y, w: enc.w, h: enc.h });
      pen.text(r.x + r.w / 2, r.y + r.h + 16, title, { size: 9, bold: true, anchor: "middle" });
      pen.text(r.x + r.w / 2, r.y + r.h + 28, size, { size: 7, anchor: "middle" });
    };
    const inch = (mm: number) => (mm / 25.4).toFixed(mm % 25.4 === 0 ? 0 : 1);
    under("backpanel", "BACKPANEL", `${bp.w} × ${bp.h} mm (${inch(bp.w)} × ${inch(bp.h)} in) · SCALE 1:${L.scale}`);
    under("door", "DOOR, FROM THE FRONT", `ENCLOSURE ${enc.w} × ${enc.h} × ${enc.d} mm (${inch(enc.w)} × ${inch(enc.h)} × ${inch(enc.d)} in) · SCALE 1:${L.scale}`);
  }

  for (const d of L.ducts) box(R("backpanel", d), { fill: DUCT_FILL, s: { width: 0.8 } });
  for (const r of L.rails) {
    const s = R("backpanel", { x: r.x, y: r.y - DIN_H / 2, w: r.len, h: DIN_H });
    box(s, { fill: RAIL_FILL, s: { width: 0.5 } });
    pen.text(s.x - 3, s.y + s.h / 2 + 2.5, r.id, { size: 7, anchor: "end", bold: true });
  }

  // Clearances: dashed, so what must stay clear is on the drawing.
  for (const it of L.items) {
    const c = it.part?.mount?.clearance_mm;
    if (!c) continue;
    const z = R(it.face, { x: it.x - (c.left ?? 0), y: it.y - (c.top ?? 0), w: it.w + (c.left ?? 0) + (c.right ?? 0), h: it.h + (c.top ?? 0) + (c.bottom ?? 0) });
    box(z, { s: { width: 0.5, dash: [3, 3] } });
  }

  const unlabelled: Item[] = [];
  for (const it of L.items) {
    const r = R(it.face, it);
    pen.tagged({ device: it.tag }, () => {
      box(r, { fill: PART_FILL, s: { width: 1, dash: it.sized ? undefined : [4, 3] } });
      const cut = it.part?.mount?.door ? parseFloat(it.part.mount.door) : NaN;
      if (Number.isFinite(cut)) pen.circle(r.x + r.w / 2, r.y + r.h / 2, (cut / 2) * L.k, { s: { width: 0.6 } });
      const tw = textWidth(it.tag, TAG);
      if (Number.isFinite(cut)) pen.text(r.x + r.w / 2, r.y + r.h + TAG + 1, it.tag, { size: TAG, anchor: "middle" });
      else if (tw + 3 <= r.w && TAG + 3 <= r.h) pen.text(r.x + r.w / 2, r.y + r.h / 2 + TAG * 0.35, it.tag, { size: TAG, anchor: "middle" });
      else if (tw + 3 <= r.h && TAG + 1 <= r.w) pen.text(r.x + r.w / 2 + TAG * 0.35, r.y + r.h / 2, it.tag, { size: TAG, anchor: "middle", vertical: true });
      else unlabelled.push(it);
    });
  }
  // Parts too narrow for their own tag: label each run of them once,
  // inside the run on a white ground if it fits, else above the tallest
  // part under the label, stepping up past any label already there. An
  // attached part (an overload) is labelled under itself.
  const runs: Item[][] = [];
  for (const it of [...unlabelled].sort((a, b) => (a.on ?? "").localeCompare(b.on ?? "") || a.x - b.x || a.y - b.y)) {
    const run = runs[runs.length - 1];
    const last = run?.[run.length - 1];
    const sameRail = !!last && last.on === it.on && last.face === it.face && L.rails.some((r) => r.id === it.on);
    if (last && sameRail && it.x - (last.x + last.w) <= 2) run.push(it);
    else runs.push([it]);
  }
  const placed: Rect[] = [];
  const hits = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const run of runs) {
    const face = run[0].face;
    const z = R(face, { x: run[0].x, y: Math.min(...run.map((i) => i.y)), w: run[run.length - 1].x + run[run.length - 1].w - run[0].x, h: Math.max(...run.map((i) => i.y + i.h)) - Math.min(...run.map((i) => i.y)) });
    const text = tagRun(run.map((i) => i.tag));
    const tw = textWidth(text, TAG);
    const cx = z.x + z.w / 2;
    if (run.length === 1 && run[0].kind === "attached") {
      pen.tagged({ device: run[0].tag }, () => pen.text(cx, z.y + z.h + TAG + 1, text, { size: TAG, anchor: "middle" }));
      continue;
    }
    if (tw + 3 <= z.w && run.length > 1) {
      const cy = z.y + z.h / 2;
      pen.rect(cx - tw / 2 - 1.5, cy - TAG / 2 - 1.5, tw + 3, TAG + 3, { fill: PART_FILL });
      pen.text(cx, cy + TAG * 0.35, text, { size: TAG, anchor: "middle" });
      continue;
    }
    // Above the run, else below it, stepping further out each time,
    // until the label clears every part and every label already placed.
    const span = { x: cx - tw / 2 - 1, w: tw + 2 };
    const near = L.items.filter((i) => i.face === face).map((i) => R(face, i)).filter((r) => r.x < span.x + span.w && span.x < r.x + r.w && r.y < z.y + z.h && r.y + r.h > z.y);
    const top = Math.min(z.y, ...near.map((r) => r.y)) - 3;
    const bottom = Math.max(z.y + z.h, ...near.map((r) => r.y + r.h)) + TAG + 2;
    const parts = L.items.filter((i) => i.face === face).map((i) => R(face, i));
    const ducts = face === "backpanel" ? L.ducts.map((d) => R(face, d)) : [];
    const clear = (cy: number, avoid: Rect[]) => {
      const box = { x: span.x, y: cy - TAG, w: span.w, h: TAG + 1 };
      return !placed.some((b) => hits(b, box)) && !avoid.some((b) => hits(b, box));
    };
    // Clear of the duct close by; failing that, on the duct's edge rather
    // than out in the next row.
    let y = top;
    search: for (const [avoid, steps] of [[[...parts, ...ducts], 2], [parts, 4]] as [Rect[], number][])
      for (let step = 0; step < steps; step++)
        for (const cy of [top - step * (TAG + 1.5), bottom + step * (TAG + 1.5)])
          if (clear(cy, avoid)) {
            y = cy;
            break search;
          }
    placed.push({ x: span.x, y: y - TAG, w: span.w, h: TAG + 1 });
    pen.text(cx, y, text, { size: TAG, anchor: "middle" });
  }

  partsTable(pen, L);
}

/** Every mounted device: tag, what it is, what it is bought as. */
function partsTable(pen: Pen, L: PanelLayout): void {
  const t = L.table;
  if (t.w < 200) return;
  const rows = [...L.items].sort((a, b) => a.tag.localeCompare(b.tag, "en", { numeric: true }));
  const ROW = Math.max(7.5, Math.min(10.5, (t.bottom - t.y) / (rows.length + 1)));
  const cols = [
    { title: "TAG", w: 58 },
    { title: "DESCRIPTION", w: t.w - 58 - 150 },
    { title: "PART", w: 150 },
  ];
  const fits = Math.floor((t.bottom - t.y) / ROW) - 1;
  const shown = rows.length > fits ? rows.slice(0, fits - 1) : rows;
  const H = (shown.length + 1 + (shown.length < rows.length ? 1 : 0)) * ROW;
  pen.text(t.x, t.y - 4, "MOUNTED PARTS", { size: 8, bold: true });
  pen.rect(t.x, t.y, t.w, H, { s: { width: 1 } });
  let x = t.x;
  for (const c of cols) {
    pen.text(x + 3, t.y + ROW - 3, c.title, { size: 6.5, bold: true });
    if (x > t.x) pen.line(x, t.y, x, t.y + H, { width: 0.4 });
    x += c.w;
  }
  pen.line(t.x, t.y + ROW, t.x + t.w, t.y + ROW, { width: 0.8 });
  const cut = (s: string, w: number) => {
    let out = s;
    while (out.length > 1 && textWidth(out, 6.5) > w - 6) out = out.slice(0, -2) + "…";
    return out;
  };
  shown.forEach((it, i) => {
    const y = t.y + (i + 2) * ROW - 3;
    const part = it.part?.catalog ? `${it.part.manufacturer ?? ""} ${it.part.catalog}`.trim() : (it.part?.desc ?? it.partId);
    pen.tagged({ device: it.tag }, () => {
      pen.text(t.x + 3, y, it.tag, { size: 6.5 });
      pen.text(t.x + cols[0].w + 3, y, cut(it.desc, cols[1].w), { size: 6.5 });
      pen.text(t.x + cols[0].w + cols[1].w + 3, y, cut(part, cols[2].w), { size: 6.5 });
    });
  });
  if (shown.length < rows.length) pen.text(t.x + 3, t.y + (shown.length + 2) * ROW - 3, `… and ${rows.length - shown.length} more: see the bill of materials`, { size: 6.5 });
}

// ── checks ──────────────────────────────────────────────────────────────

const overlap = (a: Rect, b: Rect) => {
  const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return dx > 0.5 && dy > 0.5 ? { dx, dy } : null;
};
const mm = (v: number) => `${Math.round(v)} mm`;

/** What's wrong with one layout sheet. */
export function checkLayout(p: Project, sheet: SheetFile, ix: Index): Problem[] {
  const file = `sheets/${sheet.file}`;
  const out: Problem[] = [];
  const add = (severity: Problem["severity"], code: string, message: string, find?: string) => out.push({ severity, file, code, message, find });
  const L = panelLayout(p, sheet, ix);
  const s = sheet.sheet;

  if (!s.enclosure) add("error", "layout-enclosure", 'a layout sheet needs "enclosure": the enclosure device\'s tag');
  else if (!ix.devices.has(s.enclosure)) add("error", "layout-enclosure", `enclosure ${s.enclosure} isn't a device in panel.json`, `"${s.enclosure}"`);
  else if (!L.enclosure) add("error", "layout-enclosure", `${s.enclosure}'s part has no enclosure.size_mm`, `"${s.enclosure}"`);
  if (s.scale !== undefined && !SCALES.includes(s.scale)) add("warning", "layout-scale", `scale 1:${s.scale} isn't one of 1:${SCALES.join(", 1:")}; using 1:${L.scale}`, '"scale"');

  for (const b of L.bad) add("error", b.code, b.why, `"device": "${b.device}"`);

  const bp = L.backpanel;
  const ids = new Set<string>();
  for (const r of s.din ?? []) {
    const at = `"id": "${r?.id}"`;
    if (!L.rails.includes(r)) {
      add("error", "din-syntax", `a DIN rail needs id, x, y and len in mm`, at);
      continue;
    }
    if (ids.has(r.id)) add("error", "din-dup", `two DIN rails are called ${r.id}`, at);
    if (ix.devices.has(r.id) || ["door", "top", "left", "right"].includes(r.id)) add("error", "din-dup", `rail ${r.id} has the same name as a device or a face; call it something else`, at);
    ids.add(r.id);
    if (bp && (r.x < 0 || r.x + r.len > bp.w || r.y - DIN_H / 2 < 0 || r.y + DIN_H / 2 > bp.h))
      add("error", "din-outside", `rail ${r.id} (x ${r.x} to ${r.x + r.len}, y ${r.y}) runs off the ${bp.w} × ${bp.h} mm backpanel`, at);
  }
  for (const d of L.ducts) {
    if (bp && (d.x < 0 || d.y < 0 || d.x + d.w > bp.w || d.y + d.h > bp.h))
      add("error", "duct-outside", `duct at x ${d.x}, y ${d.y} (${d.w} × ${d.h}) runs off the ${bp.w} × ${bp.h} mm backpanel`, `"x": ${d.x}`);
    for (const r of L.rails) {
      const o = overlap(d, { x: r.x, y: r.y - DIN_H / 2, w: r.len, h: DIN_H });
      if (o) add("error", "duct-overlap", `duct at x ${d.x}, y ${d.y} covers ${mm(o.dy)} of rail ${r.id}'s 35 mm`, `"id": "${r.id}"`);
    }
  }

  const at = (it: Item) => `"device": "${it.tag}"`;
  for (const it of L.items) {
    const dev = ix.devices.get(it.tag)!;
    if (dev.field) add("warning", "mount-field", `${it.tag} is a field device; it isn't in the enclosure`, at(it));
    if (!it.kind) add("warning", "mount-size", `${it.tag}'s part (${it.partId}) has no mount: say din, backpanel, door, outside or on, and size_mm`, at(it));
    else if (!it.sized) add("warning", "mount-size", `${it.tag}'s part (${it.partId}) has no size_mm; drawn dashed at ${UNSIZED.join(" × ")} mm`, at(it));
    const rail = L.rails.find((r) => r.id === it.on);
    const where = rail ? "din" : it.on === "door" ? "door" : ["top", "left", "right"].includes(it.on ?? "") ? "outside" : it.on && it.on !== "door" ? "attached" : "backpanel";
    const want: Record<MountKind, string> = { din: "on a DIN rail", backpanel: "on the backpanel", door: "on the door", outside: "outside the enclosure", attached: `on the device it attaches to (${it.part?.mount?.on})` };
    if (it.kind && it.kind !== where) add("warning", "mount-kind", `${it.tag} mounts ${want[it.kind]}, but this sheet has it ${want[where as MountKind] ?? where}`, at(it));
    if (rail && (it.x < rail.x - 0.5 || it.x + it.w > rail.x + rail.len + 0.5))
      add("error", "mount-rail-end", `${it.tag} (x ${it.x} to ${it.x + it.w}) hangs off rail ${rail.id} (x ${rail.x} to ${rail.x + rail.len})`, at(it));
    else if (where === "backpanel" && bp && (it.x < 0 || it.y < 0 || it.x + it.w > bp.w || it.y + it.h > bp.h))
      add("error", "mount-outside", `${it.tag} (x ${it.x}, y ${it.y}, ${it.w} × ${it.h}) runs off the ${bp.w} × ${bp.h} mm backpanel`, at(it));
    else if (where === "door" && L.enclosure && (it.x < 0 || it.y < 0 || it.x + it.w > L.enclosure.w || it.y + it.h > L.enclosure.h))
      add("error", "mount-outside", `${it.tag} runs off the ${L.enclosure.w} × ${L.enclosure.h} mm door`, at(it));
  }

  // Overlaps, face by face: parts with parts, parts with duct, and parts
  // screwed to the backpanel with rails.
  const faceItems = (f: Face) => L.items.filter((i) => i.face === f);
  for (const f of ["backpanel", "door"] as Face[]) {
    const list = faceItems(f);
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = [list[i], list[j]];
        if (a.on === b.tag || b.on === a.tag) continue;
        const o = overlap(a, b);
        if (o) add("error", "mount-overlap", `${a.tag} and ${b.tag} overlap by ${mm(o.dx)} × ${mm(o.dy)}`, at(b));
      }
  }
  for (const it of faceItems("backpanel")) {
    for (const d of L.ducts) {
      const o = overlap(it, d);
      if (o) add("error", "mount-overlap", `${it.tag} sits ${mm(Math.min(o.dx, o.dy))} into the duct at x ${d.x}, y ${d.y}`, at(it));
    }
    if (L.rails.some((r) => r.id === it.on) || it.kind === "attached") continue;
    for (const r of L.rails) {
      const o = overlap(it, { x: r.x, y: r.y - DIN_H / 2, w: r.len, h: DIN_H });
      if (o) add("error", "mount-overlap", `${it.tag} is screwed down over rail ${r.id}`, at(it));
    }
  }

  // Clearances a part asks for (a drive's airflow).
  for (const it of L.items) {
    const c = it.part?.mount?.clearance_mm;
    if (!c) continue;
    const zones: [string, number | undefined, Rect][] = [
      ["above", c.top, { x: it.x, y: it.y - (c.top ?? 0), w: it.w, h: c.top ?? 0 }],
      ["below", c.bottom, { x: it.x, y: it.y + it.h, w: it.w, h: c.bottom ?? 0 }],
      ["to the left of", c.left, { x: it.x - (c.left ?? 0), y: it.y, w: c.left ?? 0, h: it.h }],
      ["to the right of", c.right, { x: it.x + it.w, y: it.y, w: c.right ?? 0, h: it.h }],
    ];
    for (const [side, need, z] of zones) {
      if (!need) continue;
      const others: [string, Rect][] = [
        ...L.items.filter((o) => o.face === it.face && o !== it && o.on !== it.tag).map((o) => [o.tag, o] as [string, Rect]),
        ...(it.face === "backpanel" ? L.ducts.map((d) => [`the duct at x ${d.x}, y ${d.y}`, d] as [string, Rect]) : []),
      ];
      for (const [name, r] of others) {
        const o = overlap(z, r);
        if (o) add("warning", "mount-clearance", `${it.tag} needs ${need} mm clear ${side} it (${it.part?.catalog ?? it.partId}); ${name} is ${mm(side === "above" || side === "below" ? o.dy : o.dx)} into that space`, at(it));
      }
    }
  }
  return out;
}

/** Non-field devices that no layout sheet mounts (the enclosure aside). */
export function unmounted(p: Project, ix: Index): string[] {
  const layouts = p.sheets.filter((s) => s.sheet.kind === "layout");
  if (!layouts.length) return [];
  const mounted = new Set(layouts.flatMap((s) => (s.sheet.mount ?? []).map((m) => m?.device)));
  const enclosures = new Set(layouts.map((s) => s.sheet.enclosure));
  return [...ix.devices.values()].filter((d) => !d.field && !mounted.has(d.tag) && !enclosures.has(d.tag)).map((d) => d.tag);
}

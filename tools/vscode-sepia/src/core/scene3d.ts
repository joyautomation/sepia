// The panel in 3D (PNL-F13): the layout sheet's parts as boxes, and the
// checks only depth can answer: does a door operator clear what's behind
// it, does a part fit between the backpanel and the door, does a side
// mounted unit fit the side. Everything comes from panelLayout, so the 2D
// sheet and the 3D view can't disagree.
//
// Coordinates are mm, seen from the front: x from the enclosure's left,
// y down from its top, z out from the outside of its back wall toward the
// door. The viewer flips y; nothing else changes.

import type { Problem, Project, SheetFile } from "./types.ts";
import { resolvePart, type Index } from "./model.ts";
import { DIN_H, panelLayout, type Item, type PanelLayout } from "./backpanel.ts";

/** Where the backpanel's face is, from the outside of the back, when the
 * enclosure part doesn't say: 2 mm wall, 16 mm collar studs, 3 mm panel. */
export const PANEL_FACE_MM = 21;
/** The door's thickness when the part doesn't say. */
export const DOOR_MM = 2;
/** What the door opening's return and the back bend take off each side's
 * flat depth when the part doesn't say (front 20, back 10). */
export const SIDE_LOST_MM = 30;
/** Room to leave between a door operator and what's behind it: the
 * contact blocks' screws and a hand on the door as it closes. */
export const DOOR_GAP_MM = 13;
const RAIL: [number, number] = [DIN_H, 7.5];
const DUCT_D = 80;

export type BoxKind = "enclosure" | "backpanel" | "rail" | "duct" | "part" | "clearance";

export type Box3 = {
  id: string;
  kind: BoxKind;
  /** The device's tag, for a part or its clearance. */
  tag?: string;
  /** Which side of the closed enclosure it's on: inside on the backpanel,
   * on the door (it swings with it), or outside. */
  on: "inside" | "door" | "outside";
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  /** Drawn as a guess: the part has no size. */
  unsized?: boolean;
  /** Hover text: tag, description, part. */
  label?: string;
};

export type Scene3D = {
  enclosure: { tag?: string; w: number; h: number; d: number; door: number; panelFace: number; sideFlat: number; hinge: "left" | "right" };
  boxes: Box3[];
};

/** The enclosure's depth facts, from its part or the defaults above. */
function depthOf(p: Project, ix: Index, L: PanelLayout): Scene3D["enclosure"] {
  const dev = L.enclosure ? ix.devices.get(L.enclosure.tag) : undefined;
  const e = dev ? resolvePart(p.parts, dev.part)?.enclosure : undefined;
  const w = L.enclosure?.w ?? 600;
  const h = L.enclosure?.h ?? 800;
  const d = L.enclosure?.d ?? 250;
  return {
    tag: L.enclosure?.tag,
    w,
    h,
    d,
    door: e?.door_mm ?? DOOR_MM,
    panelFace: e?.panel_face_mm ?? PANEL_FACE_MM,
    sideFlat: e?.side_flat_mm ?? d - SIDE_LOST_MM,
    hinge: e?.hinge ?? "left",
  };
}

function sectionOf(p: Project, partId: string | undefined, fallback: [number, number]): [number, number] {
  const s = partId ? resolvePart(p.parts, partId)?.section_mm : undefined;
  return s && s.length === 2 && s.every(Number.isFinite) ? s : fallback;
}

const labelOf = (it: Item) => [it.tag, it.desc, it.part?.catalog ? `${it.part.manufacturer ?? ""} ${it.part.catalog}`.trim() : it.partId].filter(Boolean).join("\n");

/** Where an item sits in 3D. */
function placeItem(L: PanelLayout, E: Scene3D["enclosure"], it: Item): Box3 {
  const base = { id: `part:${it.tag}`, kind: "part" as const, tag: it.tag, w: it.w, h: it.h, d: it.d, unsized: !it.sized || undefined, label: labelOf(it) };
  const bp = L.backpanel ?? { x: 0, y: 0 };
  if (it.face === "backpanel") return { ...base, on: "inside", x: bp.x + it.x, y: bp.y + it.y, z: E.panelFace };
  // The door view: on the door, on top, or on a side.
  if (it.y < 0) return { ...base, on: "outside", x: it.x, y: it.y, z: (E.d - it.d) / 2 };
  if (it.x < 0 || it.x >= E.w) return { ...base, on: "outside", x: it.x, y: it.y, z: (E.d - it.d) / 2 };
  // Behind the door: its depth reaches back into the enclosure.
  return { ...base, on: "door", x: it.x, y: it.y, z: E.d - E.door - it.d };
}

export function panelScene(p: Project, sheet: SheetFile, ix: Index, L: PanelLayout = panelLayout(p, sheet, ix)): Scene3D {
  const E = depthOf(p, ix, L);
  const boxes: Box3[] = [];
  const bp = L.backpanel ?? { w: E.w, h: E.h, x: 0, y: 0 };
  const T = 2; // wall thickness, for drawing
  boxes.push(
    { id: "wall:back", kind: "enclosure", on: "inside", x: 0, y: 0, z: 0, w: E.w, h: E.h, d: T },
    { id: "wall:left", kind: "enclosure", on: "inside", x: 0, y: 0, z: 0, w: T, h: E.h, d: E.d - E.door },
    { id: "wall:right", kind: "enclosure", on: "inside", x: E.w - T, y: 0, z: 0, w: T, h: E.h, d: E.d - E.door },
    { id: "wall:top", kind: "enclosure", on: "inside", x: 0, y: 0, z: 0, w: E.w, h: T, d: E.d - E.door },
    { id: "wall:bottom", kind: "enclosure", on: "inside", x: 0, y: E.h - T, z: 0, w: E.w, h: T, d: E.d - E.door },
    { id: "wall:door", kind: "enclosure", on: "door", x: 0, y: 0, z: E.d - E.door, w: E.w, h: E.h, d: E.door },
    { id: "backpanel", kind: "backpanel", on: "inside", x: bp.x, y: bp.y, z: E.panelFace - 3, w: bp.w, h: bp.h, d: 3 },
  );
  for (const r of L.rails) {
    const [rw, rd] = sectionOf(p, r.part, RAIL);
    boxes.push({ id: `rail:${r.id}`, kind: "rail", on: "inside", x: bp.x + r.x, y: bp.y + r.y - rw / 2, z: E.panelFace, w: r.len, h: rw, d: rd, label: `Rail ${r.id}\n${r.len} mm` });
  }
  L.ducts.forEach((u, i) => {
    const [, ud] = sectionOf(p, u.part, [Math.min(u.w, u.h), DUCT_D]);
    boxes.push({ id: `duct:${i}`, kind: "duct", on: "inside", x: bp.x + u.x, y: bp.y + u.y, z: E.panelFace, w: u.w, h: u.h, d: ud, label: `Wire duct\n${u.w} × ${u.h} mm` });
  });
  for (const it of L.items) {
    const b = placeItem(L, E, it);
    boxes.push(b);
    const c = it.part?.mount?.clearance_mm;
    if (c && b.on === "inside")
      boxes.push({
        id: `clear:${it.tag}`,
        kind: "clearance",
        tag: it.tag,
        on: "inside",
        x: b.x - (c.left ?? 0),
        y: b.y - (c.top ?? 0),
        z: b.z,
        w: b.w + (c.left ?? 0) + (c.right ?? 0),
        h: b.h + (c.top ?? 0) + (c.bottom ?? 0),
        d: b.d,
      });
  }
  return { enclosure: E, boxes };
}

const mm = (n: number) => `${Math.round(n)} mm`;
const overlapXY = (a: Box3, b: Box3) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;

/** The checks only depth answers, with the arithmetic in each message. */
export function checkDepth(p: Project, sheet: SheetFile, ix: Index, L: PanelLayout = panelLayout(p, sheet, ix)): Problem[] {
  const S = panelScene(p, sheet, ix, L);
  const E = S.enclosure;
  if (!L.enclosure) return [];
  const file = `sheets/${sheet.file}`;
  const out: Problem[] = [];
  const add = (severity: Problem["severity"], code: string, message: string, tag: string) => out.push({ severity, file, code, message, find: `"device": "${tag}"` });
  const room = E.d - E.door - E.panelFace; // backpanel face to the door's inside
  const inside = S.boxes.filter((b) => b.on === "inside" && (b.kind === "part" || b.kind === "duct"));
  const name = (b: Box3) => b.tag ?? (b.kind === "duct" ? `the duct at x ${Math.round(b.x - (L.backpanel?.x ?? 0))}, y ${Math.round(b.y - (L.backpanel?.y ?? 0))}` : b.id);
  const what = (b: Box3) => (b.tag ? (L.items.find((i) => i.tag === b.tag)?.part?.catalog ?? "") : "");

  // A part too deep for the enclosure, door or no door.
  for (const b of inside)
    if (b.tag && b.d > room)
      add("error", "mount-depth", `${b.tag} stands ${mm(b.d)} off the backpanel${what(b) ? ` (${what(b)})` : ""}; there is ${mm(room)} between the backpanel and the door (${mm(E.d)} deep less ${mm(E.panelFace)} to the backpanel's face and ${mm(E.door)} of door)`, b.tag);

  // A door operator against whatever is behind it.
  for (const a of S.boxes.filter((b) => b.on === "door" && b.kind === "part")) {
    for (const b of inside) {
      if (!overlapXY(a, b)) continue;
      const gap = room - a.d - b.d;
      const why = `${a.tag} reaches ${mm(a.d)} behind the door and ${name(b)} stands ${mm(b.d)} off the backpanel; with ${mm(room)} between the backpanel and the door`;
      if (gap < 0) add("error", "door-depth", `${why}, the door won't close: ${mm(-gap)} too much`, a.tag!);
      else if (gap < DOOR_GAP_MM) add("warning", "door-depth", `${why}, ${mm(gap)} is left (keep ${DOOR_GAP_MM} mm)`, a.tag!);
    }
  }

  // A unit on a side: its mounting face across the side's depth.
  for (const it of L.items) {
    if (it.face !== "door" || !(it.x < 0 || it.x >= E.w) || it.y < 0) continue;
    const across = it.d;
    if (across > E.sideFlat) {
      const how = L.enclosure && E.sideFlat === E.d - SIDE_LOST_MM ? ` (${mm(E.d)} deep less about ${SIDE_LOST_MM} mm for the door opening's return and the back bend; say enclosure.side_flat_mm from the maker's drawing)` : "";
      add("warning", "side-fit", `${it.tag}'s mounting face is ${mm(across)} across${it.part?.catalog ? ` (${it.part.catalog})` : ""}; the side has ${mm(E.sideFlat)} flat${how}. Check the cutout drawing, or move it to the door`, it.tag);
    }
  }
  return out;
}

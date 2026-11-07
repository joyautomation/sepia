// Gestures on a sheet become ops; an op rewrites the sheet's JSON text.
// Only placement changes here: connections live in panel.json and a drag
// never touches them.

import { formatJson } from "./format.ts";
import type { Mount, SheetJson } from "./types.ts";

export type SheetOp =
  | { type: "move"; piece: string; line: number; col: number }
  | { type: "place"; piece: string; line: number; col: number }
  | { type: "unplace"; piece: string }
  | { type: "mount"; device: string; on?: string; x?: number; y?: number }
  | { type: "unmount"; device: string };

export function applySheetOp(text: string, op: SheetOp): { text: string } | { error: string } {
  let sheet: SheetJson;
  try {
    sheet = JSON.parse(text);
  } catch (e) {
    return { error: `the sheet doesn't parse: ${(e as Error).message}` };
  }
  if (op.type === "mount" || op.type === "unmount") return mountOp(sheet, op);
  const place = (sheet.place ??= []);
  const i = place.findIndex((p) => p.piece === op.piece);
  if (op.type === "unplace") {
    if (i < 0) return { error: `${op.piece} isn't on this sheet` };
    place.splice(i, 1);
    return { text: formatJson(sheet) };
  }
  const taken = place.find((p, j) => j !== i && p.line === op.line && p.col === op.col);
  if (taken) return { error: `line ${op.line}, column ${op.col} already has ${taken.piece}` };
  if (op.type === "move") {
    if (i < 0) return { error: `${op.piece} isn't on this sheet` };
    place[i] = { ...place[i], line: op.line, col: op.col };
  } else {
    if (i >= 0) return { error: `${op.piece} is already on this sheet` };
    place.push({ piece: op.piece, line: op.line, col: op.col });
  }
  return { text: formatJson(sheet) };
}

/** Mount a device (or move it), or take it off the layout. Overlaps are
 * the checker's to report, not a reason to refuse: a drawing in progress
 * overlaps all the time. */
function mountOp(sheet: SheetJson, op: Extract<SheetOp, { type: "mount" | "unmount" }>): { text: string } | { error: string } {
  const mount = (sheet.mount ??= []);
  const i = mount.findIndex((m) => m.device === op.device);
  if (op.type === "unmount") {
    if (i < 0) return { error: `${op.device} isn't mounted on this sheet` };
    mount.splice(i, 1);
    return { text: formatJson(sheet) };
  }
  const m: Mount = { device: op.device };
  if (op.on !== undefined) m.on = op.on;
  if (op.x !== undefined) m.x = op.x;
  if (op.y !== undefined) m.y = op.y;
  if (i < 0) mount.push(m);
  else mount[i] = m;
  return { text: formatJson(sheet) };
}

// Gestures on a sheet become ops; an op rewrites the sheet's JSON text.
// Only placement changes here: connections live in panel.json and a drag
// never touches them.

import { formatJson } from "./format.ts";
import type { SheetJson } from "./types.ts";

export type SheetOp =
  | { type: "move"; piece: string; line: number; col: number }
  | { type: "place"; piece: string; line: number; col: number }
  | { type: "unplace"; piece: string };

export function applySheetOp(text: string, op: SheetOp): { text: string } | { error: string } {
  let sheet: SheetJson;
  try {
    sheet = JSON.parse(text);
  } catch (e) {
    return { error: `the sheet doesn't parse: ${(e as Error).message}` };
  }
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

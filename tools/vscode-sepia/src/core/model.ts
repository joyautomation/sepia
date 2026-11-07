// Resolving references across the files: a wire's "M101A:A1" → device M101A
// → its part → the piece that owns terminal A1 → where a sheet placed that
// piece. Every view and every check goes through this one index.

import type { Device, Part, PieceDef, Placement, Project, Wire } from "./types.ts";

export type PieceInfo = {
  /** "M101A.coil" */
  ref: string;
  device: Device;
  part: Part | undefined;
  name: string;
  def: PieceDef;
};

export type PlacedAt = Placement & { sheet: string };

export type TerminalInfo = { piece: PieceInfo; index: number };

export type Index = {
  devices: Map<string, Device>;
  pieces: Map<string, PieceInfo>;
  /** "M101A:A1" → its piece and position in the piece's terminal list. */
  terminals: Map<string, TerminalInfo>;
  /** "M101A:A1" → the wire number on it. */
  wireAt: Map<string, Wire>;
  wires: Map<string, Wire>;
  /** "M101A.coil" → every sheet placement of it. */
  placed: Map<string, PlacedAt[]>;
};

export function splitPiece(ref: string): [string, string] {
  const i = ref.lastIndexOf(".");
  return i < 0 ? [ref, ""] : [ref.slice(0, i), ref.slice(i + 1)];
}

export function splitTerminal(ref: string): [string, string] {
  const i = ref.indexOf(":");
  return i < 0 ? [ref, ""] : [ref.slice(0, i), ref.slice(i + 1)];
}

/** Repeated pieces spelled out: "di{n}" × 16 → di0…di15. */
export function expandPieces(pieces: Record<string, PieceDef> | undefined): Record<string, PieceDef> {
  const out: Record<string, PieceDef> = {};
  for (const [name, def] of Object.entries(pieces ?? {})) {
    if (!def?.count) {
      out[name] = def;
      continue;
    }
    const { count, from = 1, ...rest } = def;
    for (let n = from; n < from + count; n++) {
      const sub = (x: string) => x.replaceAll("{n}", String(n));
      out[sub(name)] = { ...rest, terminals: (rest.terminals ?? []).map(sub) };
    }
  }
  return out;
}

/** A part as the drawing sees it: an assembly takes its base's fields and
 * pieces, and adds or overrides its own. */
export function resolvePart(parts: Record<string, Part>, id: string, seen: Set<string> = new Set()): Part | undefined {
  const part = parts[id];
  if (!part || !part.base || seen.has(id)) return part ? { ...part, pieces: expandPieces(part.pieces) } : undefined;
  seen.add(id);
  const base = resolvePart(parts, part.base, seen);
  return { ...base, ...part, pieces: { ...base?.pieces, ...expandPieces(part.pieces) }, ratings: part.ratings ?? base?.ratings };
}

export function buildIndex(p: Project): Index {
  const devices = new Map<string, Device>();
  const pieces = new Map<string, PieceInfo>();
  const terminals = new Map<string, TerminalInfo>();
  const resolved = new Map<string, Part | undefined>();
  for (const d of p.panel.devices ?? []) {
    if (!d?.tag || devices.has(d.tag)) continue;
    devices.set(d.tag, d);
    if (!resolved.has(d.part)) resolved.set(d.part, resolvePart(p.parts, d.part));
    const part = resolved.get(d.part);
    for (const [name, def] of Object.entries(part?.pieces ?? {})) {
      const info: PieceInfo = { ref: `${d.tag}.${name}`, device: d, part, name, def };
      pieces.set(info.ref, info);
      (def.terminals ?? []).forEach((t, index) => {
        const key = `${d.tag}:${t}`;
        if (!terminals.has(key)) terminals.set(key, { piece: info, index });
      });
    }
  }
  const wires = new Map<string, Wire>();
  const wireAt = new Map<string, Wire>();
  for (const w of p.panel.wires ?? []) {
    if (!w?.no) continue;
    if (!wires.has(w.no)) wires.set(w.no, w);
    for (const t of w.run ?? []) if (!wireAt.has(t)) wireAt.set(t, w);
  }
  const placed = new Map<string, PlacedAt[]>();
  for (const s of p.sheets) {
    for (const pl of s.sheet.place ?? []) {
      const list = placed.get(pl.piece) ?? [];
      list.push({ ...pl, sheet: s.name });
      placed.set(pl.piece, list);
    }
  }
  return { devices, pieces, terminals, wireAt, wires, placed };
}

/** The other terminals on the same wire as `term`, in pull order. */
export function otherEnds(ix: Index, term: string): string[] {
  const w = ix.wireAt.get(term);
  return w ? w.run.filter((t) => t !== term) : [];
}

/** Line numbers where a device's other pieces are placed, for the
 * cross-reference printed beside its coil. */
export function crossRefs(ix: Index, piece: PieceInfo): { line: number; nc: boolean; sheet: string }[] {
  const out: { line: number; nc: boolean; sheet: string }[] = [];
  for (const [ref, info] of ix.pieces) {
    if (info.device !== piece.device || ref === piece.ref) continue;
    for (const at of ix.placed.get(ref) ?? []) {
      out.push({ line: at.line, nc: /-nc$/.test(info.def.symbol), sheet: at.sheet });
    }
  }
  return out.sort((a, b) => a.line - b.line);
}

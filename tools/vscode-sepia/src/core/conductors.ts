// Conductors: the physical wires. A wire in panel.json is one potential,
// its run listed in pull order. Each pair of neighbours in that order is
// one conductor, cut, sleeved and landed on its own. A middle terminal in
// a run has two conductors on it.
//
// What a conductor's sleeves say depends on the numbering scheme
// (sepia.json `numbering`, docs/design.md §3.1):
//   line     both sleeves carry the wire number (302A)
//   from-to  each sleeve carries the terminal at the other end, so whoever
//            is holding one end knows where it goes (M101B:22 at M101A:A1)
// A conductor with an end on a field device follows `numbering.field`;
// every other conductor follows `numbering.default`.

import type { Index } from "./model.ts";
import type { Project, Wire } from "./types.ts";

export type Scheme = "line" | "from-to";

export type Conductor = {
  wire: Wire;
  from: string;
  to: string;
  /** An end is on a device outside the enclosure. */
  field: boolean;
  scheme: Scheme;
  /** The sleeve at each end. */
  markFrom: string;
  markTo: string;
};

const scheme = (v: unknown, dflt: Scheme): Scheme => (v === "line" || v === "from-to" ? v : dflt);

export function schemes(p: Project): { internal: Scheme; field: Scheme } {
  const n = p.sepia.numbering;
  const internal = scheme(n?.default, "line");
  return { internal, field: scheme(n?.field, internal) };
}

export function conductors(p: Project, ix: Index): Conductor[] {
  const s = schemes(p);
  const isField = (t: string) => !!ix.devices.get(t.slice(0, t.indexOf(":")))?.field;
  const out: Conductor[] = [];
  for (const w of p.panel.wires ?? []) {
    const run = w?.run ?? [];
    for (let i = 1; i < run.length; i++) {
      const [from, to] = [run[i - 1], run[i]];
      const field = isField(from) || isField(to);
      const sc = field ? s.field : s.internal;
      out.push({ wire: w, from, to, field, scheme: sc, markFrom: sc === "line" ? w.no : to, markTo: sc === "line" ? w.no : from });
    }
  }
  return out;
}

/** Wires that carry a printed number: any of their conductors is line-numbered. */
export function numberedWires(cs: Conductor[]): Set<string> {
  return new Set(cs.filter((c) => c.scheme === "line").map((c) => c.wire.no));
}

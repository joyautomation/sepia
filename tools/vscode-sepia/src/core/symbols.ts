// Built-in symbols. A symbol's drawing is a Svelte component in
// webview/symbols; its geometry (where the ports are) lives here so the
// layout, the checks and the CLI agree without a DOM.
//
// Units are hundredths of an inch on the sheet. Two-terminal symbols are
// drawn left to right: terminals[0] on the left port, terminals[1] on the
// right.

export type SymbolGeom = {
  /** Port x offsets from the cell centre, in terminal order. */
  ports: number[];
  /** Can it go on a ladder line? (Three-pole power symbols can't, yet.) */
  ladder: boolean;
};

export const SYMBOLS: Record<string, SymbolGeom> = {
  "nema/contact-no": { ports: [-25, 25], ladder: true },
  "nema/contact-nc": { ports: [-25, 25], ladder: true },
  "nema/selector-no": { ports: [-25, 25], ladder: true },
  "nema/ol-nc": { ports: [-25, 25], ladder: true },
  "nema/coil": { ports: [-25, 25], ladder: true },
  "plc/di": { ports: [-35], ladder: true },
  "plc/do": { ports: [35], ladder: true },
  "nema/contact-3p": { ports: [], ladder: false },
  "nema/ol-3p": { ports: [], ladder: false },
};

/** Ladder sheets have this many columns between the rails. */
export const LADDER_COLS = 10;

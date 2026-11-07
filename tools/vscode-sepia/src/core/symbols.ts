// Built-in symbols: where each one's ports are. The drawing is in
// sheetDraw.ts (drawSymbol); the geometry lives here so the layout, the
// checks and the CLI agree without drawing anything.
//
// Units are hundredths of an inch on the sheet, about the cell centre, y down.
//
// Ladder symbols lie along a horizontal line: terminals[0] on the left port,
// terminals[1] on the right.
//
// Power symbols stand on a vertical branch with one pole per phase. A
// pass-through symbol (fuse, contact, drive…) takes its terminals in
// line/load pairs, [L1, T1, L2, T2, …]: pole k's line terminal is on top and
// its load terminal underneath. Poles sit POLE apart starting at x = -POLE,
// so pole 1 of a two-pole fuse lines up with phase 1 of a three-pole
// contactor below it, and wires between them drop straight down.

export type SheetKind = "ladder" | "power";

export type Port = { x: number; y: number };

export type SymbolGeom = {
  /** Which sheets it can be placed on. */
  kinds: SheetKind[];
  /** Port positions for a piece with `n` terminals, in terminal order. */
  ports: (n: number) => Port[];
};

export const POLE = 24;
/** Power ports sit this far above and below the cell centre. */
export const POWER_PORT_Y = 30;

const twoPort = (dx = 25): SymbolGeom => ({ kinds: ["ladder"], ports: () => [{ x: -dx, y: 0 }, { x: dx, y: 0 }] });
const poleX = (k: number) => -POLE + k * POLE;
/** Half-width of an I/O box, and where its one port is. */
export const IO_BOX = 32;
export const IO_PORT = 44;
const oneIn: SymbolGeom = { kinds: ["ladder"], ports: () => [{ x: -IO_PORT, y: 0 }] };
const oneOut: SymbolGeom = { kinds: ["ladder"], ports: () => [{ x: IO_PORT, y: 0 }] };

/** Line/load pairs, one pole per pair. */
const pass: SymbolGeom = {
  kinds: ["power"],
  ports: (n) =>
    Array.from({ length: n }, (_, i) => ({ x: poleX(Math.floor(i / 2)), y: i % 2 ? POWER_PORT_Y : -POWER_PORT_Y })),
};
/** Every terminal on top (a load: motor, surge device, monitor). */
const top: SymbolGeom = { kinds: ["power"], ports: (n) => Array.from({ length: n }, (_, i) => ({ x: poleX(i), y: -POWER_PORT_Y })) };
/** Every terminal underneath (a source feeding the sheet). */
const bottom: SymbolGeom = { kinds: ["power"], ports: (n) => Array.from({ length: n }, (_, i) => ({ x: poleX(i), y: POWER_PORT_Y })) };

export const SYMBOLS: Record<string, SymbolGeom> = {
  // Ladder
  "nema/contact-no": twoPort(),
  "nema/contact-nc": twoPort(),
  "nema/selector-no": twoPort(),
  "nema/pb-no": twoPort(),
  "nema/float-no": twoPort(),
  "nema/ol-nc": twoPort(),
  "nema/coil": twoPort(),
  "nema/cb": twoPort(),
  "nema/fuse": twoPort(),
  "nema/heater": twoPort(),
  "nema/pilot": twoPort(),
  "nema/box": twoPort(),
  /** A terminal block: both ports are the same terminal, one potential. */
  "nema/terminal": twoPort(7),
  // I/O points and single device terminals: a box with a short lead, so a
  // branch dropping onto the port stays clear of the box outline.
  "plc/di": oneIn,
  "plc/ai": oneIn,
  "plc/do": oneOut,
  /** One terminal of a device, wire coming in from the left / going out right. */
  "box/in": oneIn,
  "box/out": oneOut,
  // Power
  "power/disconnect-fused": pass,
  "power/fuse": pass,
  "power/contact": pass,
  "power/ol": pass,
  "power/vfd": pass,
  "power/xfmr": pass,
  "power/motor": top,
  "power/spd": top,
  "power/box": top,
  "power/source": bottom,
};

/** Positions along a line when the sheet doesn't say. */
export const DEFAULT_COLS: Record<SheetKind, number> = { ladder: 10, power: 6 };

export function sheetKind(kind: string | undefined): SheetKind | undefined {
  return kind === undefined || kind === "ladder" ? "ladder" : kind === "power" ? "power" : undefined;
}

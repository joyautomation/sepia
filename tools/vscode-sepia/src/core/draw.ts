// The drawing's display list: a few vector primitives that the sheet editor
// renders as SVG and `sepia print` writes as PDF, so print and screen are
// the same picture by construction. Adapted from nautilus
// (tools/vscode-iec/webview-ui/src/export/draw.ts, Apache-2.0).
//
// Units are the sheet's: hundredths of an inch, y down.

export type Stroke = { color?: string; width?: number; dash?: number[] };

export type Seg = ["M", number, number] | ["L", number, number] | ["Z"];

export type TextStyle = { size: number; anchor?: "start" | "middle" | "end"; bold?: boolean; color?: string };

/** What a primitive belongs to, so the editor can hit-test and highlight. */
export type Meta = { piece?: string; wire?: string };

export type Prim = (
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; s: Stroke }
  | { t: "rect"; x: number; y: number; w: number; h: number; fill?: string; s?: Stroke }
  | { t: "circle"; cx: number; cy: number; r: number; fill?: string; s?: Stroke }
  | { t: "path"; d: Seg[]; fill?: string; s?: Stroke }
  | ({ t: "text"; x: number; y: number; text: string } & TextStyle)
) & { meta?: Meta };

export const INK = "#000000";
export const RED = "#c62828";

// Helvetica and Helvetica-Bold advance widths (Adobe AFM, 1/1000 em) for
// ASCII 32–126: the PDF uses the built-in faces, so anchoring text at its
// middle or end needs their metrics. The screen asks for Helvetica/Arial,
// which share them.
const HELV =
  "278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584"
    .split(",").map(Number);
const HELV_B =
  "278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584"
    .split(",").map(Number);

export function textWidth(s: string, size: number, bold = false): number {
  const t = bold ? HELV_B : HELV;
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    w += c >= 32 && c <= 126 ? t[c - 32] : ch === "·" ? 278 : 556;
  }
  return (w / 1000) * size;
}

/** Draw into a display list with a translation stack and a current meta,
 * so a symbol is drawn about its own origin like a <g transform>. */
export class Pen {
  readonly items: Prim[] = [];
  private ox = 0;
  private oy = 0;
  private meta: Meta | undefined;

  at(x: number, y: number, draw: () => void): void {
    const [ox, oy] = [this.ox, this.oy];
    this.ox += x;
    this.oy += y;
    try {
      draw();
    } finally {
      [this.ox, this.oy] = [ox, oy];
    }
  }

  tagged(meta: Meta, draw: () => void): void {
    const prev = this.meta;
    this.meta = meta;
    try {
      draw();
    } finally {
      this.meta = prev;
    }
  }

  private push(p: Prim): void {
    if (this.meta) p.meta = this.meta;
    this.items.push(p);
  }

  line(x1: number, y1: number, x2: number, y2: number, s: Stroke = {}): void {
    this.push({ t: "line", x1: x1 + this.ox, y1: y1 + this.oy, x2: x2 + this.ox, y2: y2 + this.oy, s });
  }

  rect(x: number, y: number, w: number, h: number, o: { fill?: string; s?: Stroke } = {}): void {
    this.push({ t: "rect", x: x + this.ox, y: y + this.oy, w, h, ...o });
  }

  circle(cx: number, cy: number, r: number, o: { fill?: string; s?: Stroke } = {}): void {
    this.push({ t: "circle", cx: cx + this.ox, cy: cy + this.oy, r, ...o });
  }

  path(d: Seg[], o: { fill?: string; s?: Stroke } = {}): void {
    const moved = d.map((s): Seg => (s[0] === "Z" ? s : [s[0], s[1] + this.ox, s[2] + this.oy]));
    this.push({ t: "path", d: moved, ...o });
  }

  text(x: number, y: number, text: string, style: TextStyle): void {
    if (text === "") return;
    this.push({ t: "text", x: x + this.ox, y: y + this.oy, text, ...style });
  }
}

/** Where a text primitive starts, after anchoring. */
export function textLeft(p: { x: number; text: string; size: number; anchor?: string; bold?: boolean }): number {
  const w = textWidth(p.text, p.size, p.bold);
  return p.anchor === "middle" ? p.x - w / 2 : p.anchor === "end" ? p.x - w : p.x;
}

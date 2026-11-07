// The sepia file formats (docs/design.md §3). Plain data: no vscode, no DOM,
// no node — shared by the extension host, the webview and the CLI.

export type SepiaJson = {
  project?: string;
  drawing?: string;
  client?: string;
  company?: string;
  people?: { drawn?: string; checked?: string; approved?: string };
  seal?: { engineer?: string; license?: string; state?: string };
  sheet?: string;
  numbering?: { default?: string; field?: string };
  wireClasses?: Record<string, { desc?: string; color?: string; awg?: number }>;
  [k: string]: unknown;
};

export type Device = {
  tag: string;
  part: string;
  desc?: string;
  /** Selector positions, left to right ("HAND", "OFF", "AUTO"). */
  legend?: string[];
  /** What each I/O point means, by terminal: { "DI0": "Pump 1 drive output closed" }. */
  io?: Record<string, string>;
  /** Outside the enclosure (a motor, a float, the transfer switch). */
  field?: boolean;
  /** Printed under the tag: a fuse size, a breaker trip, a setting ("45 A J"). */
  rating?: string;
  [k: string]: unknown;
};

/** One potential: every terminal in `run` is the same wire number. */
export type Wire = { no: string; class?: string; run: string[] };

export type PanelJson = { devices?: Device[]; wires?: Wire[] };

export type PieceDef = {
  symbol: string;
  terminals: string[];
  /** Selector contacts: which legend position closes them. */
  position?: number;
  /** Words inside a box symbol ("24 VDC SUPPLY", "A/C"). */
  text?: string;
  /** Repeat: `count` pieces numbered from `from` (default 1). "{n}" in the
   * piece name and its terminals becomes the number: "di{n}" with
   * terminals ["DI{n}"], count 16, from 0 → di0…di15. */
  count?: number;
  from?: number;
};

export type Part = {
  id: string;
  manufacturer?: string;
  catalog?: string;
  desc?: string;
  source?: string;
  notes?: string;
  pieces?: Record<string, PieceDef>;
  /** An assembly: this part is `base` plus what's in `bom`, with the base's
   * pieces and ratings unless it lists its own. A selector with two extra
   * contact blocks, a fuse holder with its fuses. */
  base?: string;
  bom?: { part: string; qty?: number }[];
  [k: string]: unknown;
};

/** Where a piece sits. On a ladder sheet a line is a horizontal rung and
 * `col` counts left to right along it. On a power sheet a line is a vertical
 * branch and `col` counts down it. Either way a line is a path of current
 * and `col` is a position along it. */
export type Placement = { piece: string; line: number; col: number };

export type SheetJson = {
  title?: string;
  kind?: string;
  lines?: [number, number];
  /** Positions along each line (ladder 10, power 6). */
  cols?: number;
  /** Ladder: the wire numbers drawn as the left and right rails. */
  rails?: string[];
  /** What a line is for, by line number, where the drawing's own guess
   * (the device on it) isn't what you'd write: { "104": "Pump 1 bypass" }. */
  notes?: Record<string, string>;
  place?: Placement[];
};

export type SheetFile = { name: string; file: string; sheet: SheetJson };

/** The revision as git tells it (src/rev.ts). */
export type Revision = {
  /** "A", "B", … or the next letter for a draft. */
  rev: string;
  /** True when HEAD is exactly a rev-* tag. */
  issued: boolean;
  date: string;
  commit?: string;
  history: { rev: string; date: string; desc: string }[];
};

/** Everything a view needs, in one message. */
export type Project = {
  root: string;
  sepia: SepiaJson;
  panel: PanelJson;
  parts: Record<string, Part>;
  sheets: SheetFile[];
  revision: Revision;
  /** Files that failed to parse: file → message. */
  parseErrors: Record<string, string>;
};

export type Severity = "error" | "warning" | "info";

export type Problem = {
  severity: Severity;
  /** Project-relative file the problem is in. */
  file: string;
  message: string;
  /** A string to find in the file, for locating the problem (a tag, a terminal ref, a piece). */
  find?: string;
  code: string;
};

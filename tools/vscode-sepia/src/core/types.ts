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
};

export type Part = {
  id: string;
  manufacturer?: string;
  catalog?: string;
  desc?: string;
  source?: string;
  notes?: string;
  pieces?: Record<string, PieceDef>;
  [k: string]: unknown;
};

export type Placement = { piece: string; line: number; col: number };

export type SheetJson = {
  title?: string;
  kind?: string;
  lines?: [number, number];
  /** Wire numbers drawn as the left and right ladder rails. */
  rails?: [string, string];
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

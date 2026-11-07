// Reading a sepia project from disk (node only: the extension host and the
// CLI). `overlay` lets the editor substitute an open document's unsaved text.

import * as fs from "node:fs";
import * as path from "node:path";
import type { Part, Project, Revision, SheetFile } from "./core/types.ts";

/** The nearest folder at or above `start` holding a sepia.json. */
export function findRoot(start: string): string | undefined {
  let dir = fs.existsSync(start) && fs.statSync(start).isDirectory() ? start : path.dirname(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, "sepia.json"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return undefined;
    dir = up;
  }
}

function walk(dir: string, suffix: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, suffix));
    else if (e.name.endsWith(suffix)) out.push(p);
  }
  return out.sort();
}

export function loadProject(root: string, revision: Revision, overlay: Map<string, string> = new Map()): Project {
  const parseErrors: Record<string, string> = {};
  const read = <T>(abs: string, fallback: T): T => {
    const rel = path.relative(root, abs);
    try {
      const text = overlay.get(abs) ?? fs.readFileSync(abs, "utf8");
      return JSON.parse(text) as T;
    } catch (e) {
      if (fs.existsSync(abs) || overlay.has(abs)) parseErrors[rel] = (e as Error).message;
      return fallback;
    }
  };
  const sepia = read(path.join(root, "sepia.json"), {});
  const panel = read(path.join(root, "panel.json"), {});
  const parts: Record<string, Part> = {};
  const partsDir = path.join(root, "parts");
  for (const f of walk(partsDir, ".json")) {
    const id = path.relative(partsDir, f).replace(/\\/g, "/").replace(/\.json$/, "");
    const part = read<Partial<Part> | null>(f, null);
    if (part) parts[id] = { ...part, id };
  }
  const sheetsDir = path.join(root, "sheets");
  const sheets: SheetFile[] = walk(sheetsDir, ".sheet.json").map((f) => {
    const file = path.relative(sheetsDir, f).replace(/\\/g, "/");
    return { name: file.replace(/\.sheet\.json$/, ""), file, sheet: read(f, {}) };
  });
  return { root, sepia, panel, parts, sheets, revision, parseErrors };
}

// Shared helpers for the sheet editor's gesture suites. Importing this
// registers no tests. Bundle under test: env SEPIA_BUNDLE, else ../media/dist.
import assert from 'node:assert/strict';
import { mkdtempSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Browser } from './cdp.mjs';
import { recordClips } from './clips.mjs';
import { settled, waitUntil, opsPosted, sleep } from './wait.mjs';

export { recordClips, Browser, settled, waitUntil, opsPosted, sleep };
export const HERE = dirname(fileURLToPath(import.meta.url));
export const BUNDLE = process.env.SEPIA_BUNDLE || join(HERE, '../media/dist');
export const HEADLESS = process.env.HEADED !== '1';

// The compiled core (npm run build): the same code the extension host runs.
const require = createRequire(import.meta.url);
const { loadProject } = require('../out/load.js');
const { check } = require('../out/core/check.js');
const { applySheetOp } = require('../out/core/ops.js');
const { buildIndex } = require('../out/core/model.js');
const { layoutSheet, cellCentre } = require('../out/core/ladder.js');

export const ROOT = join(HERE, '../../../examples/lift-station');
const REV = { rev: 'A', issued: false, date: '2026-11-07', history: [] };

/** The example project, fresh each call (tests mutate their copy). */
export const project = () => loadProject(ROOT, REV);

/** What the extension host posts for `sheet`. */
export const message = (p, sheet) => ({ type: 'project', sheet, project: p, problems: check(p) });

/** The host's side of an op: rewrite the sheet as sheetEditor.ts does, and
 * return the project it would send next. */
export function commit(p, sheet, op) {
  const s = p.sheets.find((x) => x.name === sheet);
  const r = applySheetOp(JSON.stringify(s.sheet), op);
  if ('error' in r) throw new Error(r.error);
  s.sheet = JSON.parse(r.text);
  return p;
}

/** A cell's centre in sheet units, from the same layout the webview draws. */
export function cell(p, sheet, line, col) {
  const s = p.sheets.find((x) => x.name === sheet);
  return cellCentre(layoutSheet(p, s, buildIndex(p)).frame, line, col);
}

/** A sheet editor on `sheet`, the project delivered and the page settled. */
export class Editor {
  static async open(sheet, { p = project(), width = 1400, height = 900 } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'sepia-run-'));
    copyFileSync(join(HERE, 'host.html'), join(dir, 'host.html'));
    copyFileSync(join(BUNDLE, 'sheet.js'), join(dir, 'sheet.js'));
    copyFileSync(join(BUNDLE, 'sheet.css'), join(dir, 'sheet.css'));
    const b = await Browser.launch({ headless: HEADLESS, width, height });
    await b.navigate('file://' + join(dir, 'host.html'));
    const ed = new Editor(b, sheet, p);
    await waitUntil(() => ed.posted(), (m) => m.some((x) => x.type === 'ready'), { what: 'ready' });
    await ed.deliver(p);
    return ed;
  }

  constructor(b, sheet, p) {
    this.b = b;
    this.sheet = sheet;
    this.p = p;
  }

  async deliver(p = this.p, sheet = this.sheet) {
    this.p = p;
    this.sheet = sheet;
    await this.b.eval(`window.__deliver(${JSON.stringify(message(p, sheet))})`);
    await waitUntil(() => this.b.eval('!!document.querySelector("svg[aria-label=sheet]")'), Boolean, { what: 'the sheet' });
    await settled(this.b);
  }

  posted = () => this.b.eval('window.__POSTED__');
  ops = async () => (await this.posted()).filter((m) => m.type === 'op').map((m) => m.op);
  warnings = async () => (await this.posted()).filter((m) => m.type === 'warn').map((m) => m.text);
  reset = () => this.b.eval('window.__reset()');
  eval = (js) => this.b.eval(js);

  /** Sheet units to viewport pixels. */
  screen = (pt) => this.b.eval(`window.__toScreen(${pt.x}, ${pt.y})`);
  /** A placed piece's hit area, by ref (e.g. "M101A.coil"). */
  async piece(ref) {
    const pt = await this.b.eval(`window.__center(${JSON.stringify(`rect.hit.piece[aria-label="${ref}"]`)})`);
    assert.ok(pt, `${ref} is not drawn`);
    return pt;
  }
  /** The centre of (line, col) on screen. */
  cellOnScreen = (line, col) => this.screen(cell(this.p, this.sheet, line, col));

  /** A real press-move-release, in `steps` moves. `mid` runs before the
   * release, with the pointer still down at `to`. */
  async drag(from, to, { steps = 8, mid } = {}) {
    await this.b.mouseDown(from.x, from.y);
    for (let i = 1; i <= steps; i++) {
      await this.b.mouseMove(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
      await sleep(16);
    }
    await settled(this.b);
    if (mid) await mid();
    await this.b.mouseUp(to.x, to.y);
    await sleep(60);
    await settled(this.b);
  }

  async click(pt) {
    await this.b.click(pt.x, pt.y);
    await sleep(60);
    await settled(this.b);
  }

  async key(k, code = k, keyCode = 0) {
    await this.b.pressKey(k, { code, keyCode });
    await sleep(60);
    await settled(this.b);
  }

  async close() {
    await this.b.close();
  }
}

/** Run `fn` against a fresh editor; fail if the page threw. */
export async function withEditor(sheet, fn, opts) {
  const ed = await Editor.open(sheet, opts);
  try {
    await fn(ed);
    assert.deepEqual(await ed.eval('window.__errors'), [], 'page threw');
  } finally {
    await ed.close();
  }
}

/** Remove `ref` from `sheet` in `p` (so it shows under "Not drawn"). */
export function unplaced(p, sheet, ref) {
  return commit(p, sheet, { type: 'unplace', piece: ref });
}

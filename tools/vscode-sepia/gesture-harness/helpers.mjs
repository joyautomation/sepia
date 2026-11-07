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
const backpanel = require('../out/core/backpanel.js');

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

/** A layout sheet as the core lays it out (mm, and the sheet-unit views). */
export function panel(p, sheet) {
  const s = p.sheets.find((x) => x.name === sheet);
  return backpanel.panelLayout(p, s, buildIndex(p));
}
/** An mm point on a face, in sheet units. */
export const onFace = (L, face, x, y) => { const r = backpanel.toSheet(L, face, { x, y, w: 0, h: 0 }); return { x: r.x, y: r.y }; };
/** Where the core says a device dropped at a sheet point goes. */
export function snapAt(p, sheet, tag, pt) {
  const L = panel(p, sheet);
  const body = backpanel.bodyOf(p, buildIndex(p), tag);
  return backpanel.snapMount(L, tag, body, pt.x, pt.y);
}
/** Layout problems for one sheet. */
export function layoutProblems(p, sheet) {
  const s = p.sheets.find((x) => x.name === sheet);
  return backpanel.checkLayout(p, s, buildIndex(p));
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

/** The 3D view on a layout sheet, the project delivered and drawn. */
export class Viewer3D {
  static async open(sheet, { p = project(), width = 1400, height = 900 } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'sepia-3d-'));
    copyFileSync(join(HERE, 'host3d.html'), join(dir, 'host3d.html'));
    copyFileSync(join(BUNDLE, 'view3d.js'), join(dir, 'view3d.js'));
    copyFileSync(join(BUNDLE, 'view3d.css'), join(dir, 'view3d.css'));
    const b = await Browser.launch({ headless: HEADLESS, width, height, webgl: true });
    await b.navigate('file://' + join(dir, 'host3d.html'));
    const v = new Viewer3D(b, sheet, p);
    await waitUntil(() => b.eval('window.__POSTED__'), (m) => m.some((x) => x.type === 'ready'), { what: 'ready' });
    await v.deliver(p);
    return v;
  }

  constructor(b, sheet, p) {
    this.b = b;
    this.sheet = sheet;
    this.p = p;
  }

  async deliver(p = this.p) {
    this.p = p;
    await this.b.eval(`window.__deliver(${JSON.stringify(message(p, this.sheet))})`);
    await waitUntil(() => this.b.eval('!!(window.__view3d && window.__view3d.screenOf("backpanel"))'), Boolean, { what: 'the 3D scene' });
    await sleep(100);
  }

  eval = (js) => this.b.eval(js);
  posted = () => this.b.eval('window.__POSTED__');
  /** A box's front-face centre on screen, by scene id ("part:VFD101"). */
  async at(id) {
    const pt = await this.b.eval(`window.__view3d.screenOf(${JSON.stringify(id)})`);
    assert.ok(pt, `${id} is not in the scene`);
    return pt;
  }
  async hover(pt) {
    await this.b.moveTo(pt.x, pt.y);
    await sleep(80);
  }
  async click(pt) {
    await this.b.click(pt.x, pt.y);
    await sleep(80);
  }
  async key(k, code = k, keyCode = 0) {
    await this.b.pressKey(k, { code, keyCode });
    await sleep(80);
  }
  async screenshot(file) {
    const { data } = await this.b.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(file, Buffer.from(data, 'base64'));
  }
  async close() {
    await this.b.close();
  }
}

/** Run `fn` against a fresh 3D view; fail if the page threw. */
export async function withViewer(sheet, fn, opts) {
  const v = await Viewer3D.open(sheet, opts);
  try {
    await fn(v);
    assert.deepEqual(await v.eval('window.__errors'), [], 'page threw');
  } finally {
    await v.close();
  }
}

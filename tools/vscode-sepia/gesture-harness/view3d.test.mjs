// The 3D view under real pointer and keyboard input, in software WebGL:
// hover names a part, a click shows its depth, the door swings on its
// hinge and its operators go with it, and a change to the project
// (an op from the layout sheet, a deeper part) redraws and re-checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { recordClips, withViewer, project, commit, waitUntil, sleep } from './helpers.mjs';

recordClips('view3d');

const require = createRequire(import.meta.url);
const { buildIndex } = require('../out/core/model.js');
const { panelScene, checkDepth } = require('../out/core/scene3d.js');

const LAYOUT = '13-layout';
const sceneOf = (p) => panelScene(p, p.sheets.find((s) => s.name === LAYOUT), buildIndex(p));
const depthOf = (p) => checkDepth(p, p.sheets.find((s) => s.name === LAYOUT), buildIndex(p));
const moved = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('3D: hovering a part names it; moving off clears it', () =>
  withViewer(LAYOUT, async (v) => {
    await v.hover(await v.at('part:VFD101'));
    assert.equal(await v.eval('window.__view3d.tip()'), 'VFD101\nPump 1 drive\nAutomationDirect GS4-4015');
    assert.match(await v.eval('document.querySelector(".tip")?.innerText ?? ""'), /^VFD101\n/);
    // Top-left corner of the canvas: background.
    await v.hover({ x: 20, y: 60 });
    assert.equal(await v.eval('window.__view3d.tip()'), null);
    assert.equal(await v.eval('document.querySelector(".tip")'), null);
  }));

test('3D: a click on a part shows its depth; Escape lets it go', () =>
  withViewer(LAYOUT, async (v) => {
    const S = sceneOf(v.p);
    const E = S.enclosure;
    const vfd = S.boxes.find((b) => b.id === 'part:VFD101');
    await v.click(await v.at('part:VFD101'));
    assert.equal(await v.eval('window.__view3d.picked()'), 'VFD101');
    const room = E.d - E.door - E.panelFace;
    assert.match(await v.eval('window.__aside()'), new RegExp(`stands ${vfd.d} mm off the backpanel; ${room - vfd.d} mm to the door`));
    await v.key('Escape', 'Escape', 27);
    assert.equal(await v.eval('window.__view3d.picked()'), null);
    assert.match(await v.eval('window.__aside()'), new RegExp(`${room} mm from the backpanel to the door`));
  }));

test('3D: the door opens on its hinge and takes its operators with it', () =>
  withViewer(LAYOUT, async (v) => {
    const shut = await v.at('part:PB1');
    await v.hover(shut);
    assert.match(await v.eval('window.__view3d.tip()') ?? '', /^PB1\n/, 'PB1 is pickable through the closed door');
    await v.click(await v.eval('window.__button("Open door")'));
    await waitUntil(() => v.eval('window.__view3d.door()'), (d) => d === 'open', { what: 'the door open' });
    await sleep(500); // the swing
    const open = await v.at('part:PB1');
    assert.ok(moved(open, shut) > 50, `PB1 moved with the door: ${JSON.stringify(shut)} → ${JSON.stringify(open)}`);
    // A backpanel part stays put.
    await v.hover(open);
    assert.match(await v.eval('window.__view3d.tip()') ?? '', /^PB1\n/, 'found where the door took it');
    await v.key('d', 'KeyD', 68);
    await waitUntil(() => v.eval('window.__view3d.door()'), (d) => d === 'closed', { what: 'the door closed' });
    await sleep(500);
    assert.ok(moved(await v.at('part:PB1'), shut) < 2, 'back where it was');
    assert.deepEqual(await v.posted().then((m) => m.filter((x) => x.type === 'op')), [], 'the 3D view edits nothing');
  }));

test('3D: an op from the layout sheet moves the box, and a door that will not close is shown', () =>
  withViewer(LAYOUT, async (v) => {
    const before = await v.at('part:PB1');
    // Put PB1 in front of VFD101 (backpanel 105, 245 → door 127.5, 268 + a bit).
    const p = commit(v.p, LAYOUT, { type: 'mount', device: 'PB1', on: 'door', x: 200, y: 400 });
    // And make the enclosure 250 deep instead of 305.
    for (const part of Object.values(p.parts)) if (part.enclosure) part.enclosure.size_mm = [914, 1829, 250];
    const want = depthOf(p).filter((x) => x.code === 'door-depth');
    assert.deepEqual(want.map((x) => x.message), ["PB1 reaches 55 mm behind the door and VFD101 stands 190 mm off the backpanel; with 227 mm between the backpanel and the door, the door won't close: 18 mm too much"]);
    await v.deliver(p);
    assert.ok(moved(await v.at('part:PB1'), before) > 20, 'PB1 redrawn where the op put it');
    assert.match(await v.eval('window.__aside()'), /the door won't close: 18 mm too much/);
    // Clicking the problem picks the operator.
    const row = await v.eval(`(() => { const b = [...document.querySelectorAll('aside button.row')].find((x) => /won't close/.test(x.textContent)); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await v.click(row);
    assert.equal(await v.eval('window.__view3d.picked()'), 'PB1');
    assert.match(await v.eval('window.__aside()'), /reaches 55 mm behind the door/);
  }));

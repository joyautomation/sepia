// The panel layout sheet under real input: a DIN part dragged along and
// across rails, onto another part (it slides to free rail), a door
// operator, Delete, a device dragged in from Not mounted, and a drop off
// every rail. Each drag checks the drop target against what the core's
// snap says and against where the part is drawn after the host applies
// the op.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordClips, withEditor, project, commit, panel, onFace, snapAt, layoutProblems, opsPosted, waitUntil, sleep } from './helpers.mjs';

recordClips('layout');

const LAYOUT = '13-layout';

const drawnAt = (ed, tag) =>
  ed.eval(`(() => {
    const r = document.querySelector('rect.hit.piece[aria-label="${tag}"]');
    return r ? { x: +r.getAttribute('x'), y: +r.getAttribute('y') } : null;
  })()`);
const drop = (ed) => ed.eval('window.__drop()');
const near = (a, b, tol = 0.5) => a && b && Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;
const item = (p, tag) => panel(p, LAYOUT).items.find((i) => i.tag === tag);

/** Drag `tag` to the sheet point `pt`; check the preview, the op, and the
 * redraw before and after the host applies it. Returns the op. */
/** A sheet point as the page will see it once it has been through
 * screen pixels: what the core's snap has to be asked about. */
async function viaScreen(ed, pt) {
  // Whole pixels: a dispatched mouse event lands on one.
  const raw = await ed.screen(pt);
  const scr = { x: Math.round(raw.x), y: Math.round(raw.y) };
  return { scr, at: await ed.eval(`window.__toSheet(${scr.x}, ${scr.y})`) };
}

async function mountAndCommit(ed, tag, pt) {
  const { scr, at } = await viaScreen(ed, pt);
  const want = snapAt(ed.p, LAYOUT, tag, at);
  assert.ok(want, `the core puts ${tag} somewhere at ${JSON.stringify(at)}`);
  let mid;
  await ed.drag(await ed.piece(tag), scr, { mid: async () => (mid = await drop(ed)) });
  assert.ok(near(mid, want.rect), `drop target ${JSON.stringify(mid)}, core says ${JSON.stringify(want.rect)}`);
  const ops = await opsPosted(ed, (e) => e.ops());
  const { rect, ...fields } = want;
  assert.deepEqual(ops, [{ type: 'mount', device: tag, ...fields }]);
  assert.ok(near(await drawnAt(ed, tag), rect), 'drawn at the drop before the host answers');
  await ed.deliver(commit(ed.p, LAYOUT, ops[0]));
  assert.ok(near(await drawnAt(ed, tag), rect), 'drawn at the drop after the host applies it');
  assert.equal(await drop(ed), null);
  return ops[0];
}

/** A rail with room at its right end for `w` mm, and that spot's centre. */
function roomOnRail(p, w, not) {
  const L = panel(p, LAYOUT);
  for (const r of L.rails) {
    if (r.id === not) continue;
    const end = Math.max(r.x, ...L.items.filter((i) => i.on === r.id).map((i) => i.x + i.w));
    if (r.x + r.len - end >= w + 10) return { rail: r, at: onFace(L, 'backpanel', end + 5 + w / 2, r.y) };
  }
  throw new Error('no rail with room');
}

test('layout: a DIN part dragged to free space on another rail goes there', () =>
  withEditor(LAYOUT, async (ed) => {
    const k = item(ed.p, 'CR101');
    const { rail, at } = roomOnRail(ed.p, k.w, k.on);
    const op = await mountAndCommit(ed, 'CR101', at);
    assert.equal(op.on, rail.id);
  }));

test('layout: a DIN part dropped on another slides to the nearest free stretch', () =>
  withEditor(LAYOUT, async (ed) => {
    const host = item(ed.p, 'M101A');
    const L = panel(ed.p, LAYOUT);
    const op = await mountAndCommit(ed, 'CR101', onFace(L, 'backpanel', host.x + host.w / 2, host.y + host.h / 2));
    assert.equal(op.on, host.on);
    assert.ok(op.x + item(ed.p, 'CR101').w <= host.x || op.x >= host.x + host.w, 'not on top of M101A');
    assert.deepEqual(layoutProblems(ed.p, LAYOUT).filter((x) => x.code === 'mount-overlap' && /CR101/.test(x.message)), []);
  }));

test('layout: a door operator moves on the door in 5 mm steps', () =>
  withEditor(LAYOUT, async (ed) => {
    const s = item(ed.p, 'PB1');
    const L = panel(ed.p, LAYOUT);
    const op = await mountAndCommit(ed, 'PB1', onFace(L, 'door', s.x + s.w / 2 + 62, s.y + s.h / 2 + 141));
    assert.equal(op.on, 'door');
    assert.equal(op.x % 5, 0);
    assert.equal(op.y % 5, 0);
  }));

test('layout: Delete takes a device off; it is listed under Not mounted', () =>
  withEditor(LAYOUT, async (ed) => {
    await ed.click(await ed.piece('HTR1'));
    assert.match(await ed.eval('window.__right()'), /^HTR1/);
    await ed.key('Delete', 'Delete', 46);
    assert.deepEqual(await opsPosted(ed, (e) => e.ops()), [{ type: 'unmount', device: 'HTR1' }]);
    assert.ok(!(await ed.eval('window.__pieces()')).includes('HTR1'));
    assert.ok(await ed.eval('window.__rowOf("HTR1")'), 'listed under Not mounted');
  }));

test('layout: a device dragged in from Not mounted lands on the rail', () => {
  const p = commit(project(), LAYOUT, { type: 'unmount', device: 'CR201' });
  return withEditor(
    LAYOUT,
    async (ed) => {
      const k = { w: 20 };
      const { rail, at } = roomOnRail(ed.p, k.w);
      const v = await viaScreen(ed, at);
      const want = snapAt(ed.p, LAYOUT, 'CR201', v.at);
      const row = await ed.eval('window.__rowOf("CR201")');
      assert.ok(row);
      let mid;
      await ed.drag(row, v.scr, { steps: 16, mid: async () => (mid = await drop(ed)) });
      assert.ok(near(mid, want.rect));
      const ops = await opsPosted(ed, (e) => e.ops());
      assert.deepEqual(ops, [{ type: 'mount', device: 'CR201', on: rail.id, x: want.x }]);
      await ed.deliver(commit(ed.p, LAYOUT, ops[0]));
      assert.ok(near(await drawnAt(ed, 'CR201'), want.rect));
      assert.equal(await ed.eval('window.__rowOf("CR201")'), null);
    },
    { p },
  );
});

test('layout: a DIN part dropped away from every rail stays put', () =>
  withEditor(LAYOUT, async (ed) => {
    const before = await drawnAt(ed, 'CR101');
    const L = panel(ed.p, LAYOUT);
    // The middle of the first drive: no rail within reach.
    const v = item(ed.p, 'VFD101');
    await ed.drag(await ed.piece('CR101'), await ed.screen(onFace(L, 'backpanel', v.x + v.w / 2, v.y + v.h / 2)), {
      mid: async () => assert.equal(await drop(ed), null, 'no drop target off the rails'),
    });
    await sleep(200);
    assert.deepEqual(await ed.ops(), []);
    assert.ok(near(await drawnAt(ed, 'CR101'), before));
  }));

test('layout: clicking a device shows where it is mounted and where it is drawn', () =>
  withEditor(LAYOUT, async (ed) => {
    await ed.click(await ed.piece('M101A'));
    const right = await ed.eval('window.__right()');
    assert.match(right, /^M101A/);
    assert.match(right, /rail \w+, \d+ mm from the backpanel's left edge/);
    assert.match(right, /coil: 03-pump-1-control, line 302/);
  }));

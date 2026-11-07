// The sheet editor under real pointer and keyboard input: drag a piece,
// drop it on a taken cell, drag one in from the Not drawn list, delete,
// select, pan, zoom, page through a generated sheet. Every case asserts on
// the ops the webview posts, and the drag cases also check that the drop
// target shown mid-drag is the cell the op names and the cell the piece is
// drawn in once the host has applied it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordClips, withEditor, project, commit, cell, unplaced, opsPosted, waitUntil, sleep } from './helpers.mjs';

recordClips('sheet');

const CONTROL = '03-pump-1-control';
const POWER = '01-power';

/** Where a placed piece is drawn, in sheet units (its hit area's centre). */
const drawnAt = (ed, ref) =>
  ed.eval(`(() => {
    const r = document.querySelector('rect.hit.piece[aria-label="${ref}"]');
    if (!r) return null;
    return { x: +r.getAttribute('x') + +r.getAttribute('width') / 2, y: +r.getAttribute('y') + +r.getAttribute('height') / 2 };
  })()`);
const dropCentre = async (ed) => {
  const d = await ed.eval('window.__drop()');
  return d && { x: d.x + d.w / 2, y: d.y + d.h / 2 };
};
const near = (a, b, tol = 0.5) => a && b && Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;

/** Drag `ref` to (line, col): the drop target mid-drag, the op, the
 * optimistic redraw, and the redraw after the host applies the op. */
async function moveAndCommit(ed, ref, line, col) {
  const target = cell(ed.p, ed.sheet, line, col);
  const from = await ed.piece(ref);
  const to = await ed.screen(target);
  let mid;
  await ed.drag(from, to, { mid: async () => (mid = { drop: await dropCentre(ed), ghost: await ed.eval('window.__ghost()') }) });
  assert.ok(near(mid.drop, target), `drop target at ${JSON.stringify(mid.drop)}, cell is ${JSON.stringify(target)}`);
  assert.equal(mid.ghost, `translate(${target.x},${target.y})`);
  const ops = await opsPosted(ed, (e) => e.ops());
  assert.deepEqual(ops, [{ type: 'move', piece: ref, line, col }]);
  assert.ok(near(await drawnAt(ed, ref), target), 'drawn at the drop before the host answers');
  await ed.deliver(commit(ed.p, ed.sheet, ops[0]));
  assert.ok(near(await drawnAt(ed, ref), target), 'drawn at the drop after the host applies the op');
  assert.equal(await ed.eval('window.__drop()'), null, 'no drop target left behind');
}

test('ladder: dragging a part to an empty cell moves it there', () =>
  withEditor(CONTROL, (ed) => moveAndCommit(ed, 'M101A.coil', 308, 10)));

test('ladder: dropping on a taken cell warns and moves nothing', () =>
  withEditor(CONTROL, async (ed) => {
    const before = await drawnAt(ed, 'M101A.coil');
    await ed.drag(await ed.piece('M101A.coil'), await ed.cellOnScreen(305, 10));
    const warned = await waitUntil(() => ed.warnings(), (w) => w.length > 0, { what: 'a warning' });
    assert.deepEqual(warned, ['line 305, column 10 already has M101B.coil']);
    assert.deepEqual(await ed.ops(), []);
    assert.ok(near(await drawnAt(ed, 'M101A.coil'), before), 'stays where it was');
  }));

test('ladder: a click selects a part and moves nothing', () =>
  withEditor(CONTROL, async (ed) => {
    await ed.click(await ed.piece('M101A.coil'));
    assert.match(await ed.eval('window.__right()'), /^M101A/);
    await sleep(200);
    assert.deepEqual(await ed.ops(), []);
  }));

test('ladder: a wiggle inside the same cell is not a move', () =>
  withEditor(CONTROL, async (ed) => {
    const at = await ed.piece('M101A.coil');
    await ed.drag(at, { x: at.x + 6, y: at.y + 3 }, { steps: 3 });
    await sleep(200);
    assert.deepEqual(await ed.ops(), []);
  }));

test('ladder: Escape mid-drag cancels it', () =>
  withEditor(CONTROL, async (ed) => {
    await ed.drag(await ed.piece('M101A.coil'), await ed.cellOnScreen(308, 10), {
      mid: async () => {
        assert.ok(await ed.eval('window.__drop()'), 'drop target shown');
        await ed.key('Escape', 'Escape', 27);
        assert.equal(await ed.eval('window.__drop()'), null, 'drop target gone');
      },
    });
    await sleep(200);
    assert.deepEqual(await ed.ops(), []);
  }));

test('ladder: Delete takes the selected part off the sheet', () =>
  withEditor(CONTROL, async (ed) => {
    await ed.click(await ed.piece('OL101.nc'));
    await ed.key('Delete', 'Delete', 46);
    assert.deepEqual(await opsPosted(ed, (e) => e.ops()), [{ type: 'unplace', piece: 'OL101.nc' }]);
    assert.ok(!(await ed.eval('window.__pieces()')).includes('OL101.nc'));
    assert.ok(await ed.eval('window.__rowOf("OL101.nc")'), 'listed under Not drawn');
  }));

test('ladder: a part dragged in from Not drawn lands on the drop target', () =>
  withEditor(
    CONTROL,
    async (ed) => {
      const target = cell(ed.p, CONTROL, 302, 10);
      const row = await ed.eval('window.__rowOf("M101A.coil")');
      assert.ok(row, 'M101A.coil is listed under Not drawn');
      let mid;
      await ed.drag(row, await ed.screen(target), { steps: 16, mid: async () => (mid = await dropCentre(ed)) });
      assert.ok(near(mid, target));
      const ops = await opsPosted(ed, (e) => e.ops());
      assert.deepEqual(ops, [{ type: 'place', piece: 'M101A.coil', line: 302, col: 10 }]);
      await ed.deliver(commit(ed.p, CONTROL, ops[0]));
      assert.ok(near(await drawnAt(ed, 'M101A.coil'), target));
      assert.equal(await ed.eval('window.__rowOf("M101A.coil")'), null, 'no longer listed');
    },
    { p: unplaced(project(), CONTROL, 'M101A.coil') },
  ));

test('ladder: a part from Not drawn released off the sheet places nothing', () =>
  withEditor(
    CONTROL,
    async (ed) => {
      const row = await ed.eval('window.__rowOf("M101A.coil")');
      await ed.drag(row, { x: row.x, y: row.y + 120 });
      await sleep(200);
      assert.deepEqual(await ed.ops(), []);
      assert.equal(await ed.eval('window.__drop()'), null);
      // And the next plain move over the sheet carries nothing.
      const over = await ed.cellOnScreen(308, 5);
      await ed.b.mouseMove(over.x, over.y, { buttons: 0 });
      await sleep(100);
      assert.equal(await ed.eval('window.__drop()'), null);
    },
    { p: unplaced(project(), CONTROL, 'M101A.coil') },
  ));

test('power: dragging a part to another branch and column moves it there', () =>
  withEditor(POWER, (ed) => moveAndCommit(ed, 'PMR1.sense', 101, 5)));

test('power: dropping on a taken cell warns and moves nothing', () =>
  withEditor(POWER, async (ed) => {
    await ed.drag(await ed.piece('PMR1.sense'), await ed.cellOnScreen(103, 4));
    const warned = await waitUntil(() => ed.warnings(), (w) => w.length > 0, { what: 'a warning' });
    assert.deepEqual(warned, ['line 103, column 4 already has VFD101.power']);
    assert.deepEqual(await ed.ops(), []);
  }));

test('a click on a wire selects the wire', () =>
  withEditor(CONTROL, async (ed) => {
    // A long horizontal run, clicked halfway along.
    const s = await ed.eval(`(() => {
      const ls = [...document.querySelectorAll('line.hit')].map((l) => ({ x1: +l.getAttribute('x1'), y1: +l.getAttribute('y1'), x2: +l.getAttribute('x2'), y2: +l.getAttribute('y2'), wire: l.getAttribute('aria-label').slice(5) }));
      return ls.filter((l) => l.y1 === l.y2).sort((a, b) => Math.abs(b.x2 - b.x1) - Math.abs(a.x2 - a.x1))[0];
    })()`);
    await ed.click(await ed.screen({ x: (s.x1 + s.x2) / 2, y: s.y1 }));
    assert.match(await ed.eval('window.__right()'), new RegExp(`^Wire ${s.wire}\\b`));
  }));

test('dragging the paper pans it, and a click on the paper clears the selection', () =>
  withEditor(CONTROL, async (ed) => {
    await ed.click(await ed.piece('M101A.coil'));
    assert.match(await ed.eval('window.__right()'), /^M101A/);
    // A blank spot inside the title-block-free area, away from any part.
    const start = await ed.screen({ x: 120, y: 1000 });
    const under = await ed.eval(`window.__toSheet(${start.x}, ${start.y})`);
    const vb0 = await ed.eval('window.__viewBox()');
    await ed.drag(start, { x: start.x + 150, y: start.y - 80 });
    assert.notEqual(await ed.eval('window.__viewBox()'), vb0, 'panned');
    // The point grabbed stays under the pointer.
    const now = await ed.eval(`window.__toSheet(${start.x + 150}, ${start.y - 80})`);
    assert.ok(near(now, under, 1), `grabbed ${JSON.stringify(under)}, now under the pointer ${JSON.stringify(now)}`);
    assert.match(await ed.eval('window.__right()'), /^M101A/, 'a pan keeps the selection');
    await ed.click(await ed.screen({ x: 120, y: 1000 }));
    assert.match(await ed.eval('window.__right()'), /^Nothing selected/);
    assert.deepEqual(await ed.ops(), []);
  }));

test('the wheel zooms about the pointer', () =>
  withEditor(CONTROL, async (ed) => {
    const at = await ed.cellOnScreen(305, 5);
    const under = await ed.eval(`window.__toSheet(${at.x}, ${at.y})`);
    const w0 = +(await ed.eval('window.__viewBox()')).split(' ')[2];
    await ed.b.moveTo(at.x, at.y);
    await ed.b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: at.x, y: at.y, deltaX: 0, deltaY: -300 });
    await waitUntil(() => ed.eval('window.__viewBox()'), (v) => +v.split(' ')[2] < w0, { what: 'a zoom in' });
    const now = await ed.eval(`window.__toSheet(${at.x}, ${at.y})`);
    assert.ok(near(now, under, 1), `${JSON.stringify(under)} moved to ${JSON.stringify(now)}`);
  }));

test('F fits the sheet back after a pan', () =>
  withEditor(CONTROL, async (ed) => {
    const vb0 = await ed.eval('window.__viewBox()');
    const start = await ed.screen({ x: 120, y: 1000 });
    await ed.drag(start, { x: start.x + 200, y: start.y });
    assert.notEqual(await ed.eval('window.__viewBox()'), vb0);
    await ed.key('f', 'KeyF', 70);
    assert.equal(await ed.eval('window.__viewBox()'), vb0);
  }));

test('a generated sheet pages through and has nothing to drag', () =>
  withEditor('11-wires', async (ed) => {
    assert.match(await ed.eval('window.__header()'), /page 1 of 3/);
    assert.deepEqual(await ed.eval('window.__pieces()'), []);
    const ink1 = await ed.eval('window.__ink()');
    await ed.click(await ed.eval('window.__center(\'button[title="Next page"]\')'));
    assert.match(await ed.eval('window.__header()'), /page 2 of 3/);
    assert.notEqual(await ed.eval('window.__ink()'), ink1, 'a different page is drawn');
    // A drag across a table pans; it never posts an op.
    const a = await ed.screen({ x: 400, y: 400 });
    await ed.drag(a, { x: a.x + 100, y: a.y + 50 });
    await sleep(200);
    assert.deepEqual(await ed.ops(), []);
    await ed.click(await ed.eval('window.__center(\'button[title="Previous page"]\')'));
    assert.match(await ed.eval('window.__header()'), /page 1 of 3/);
  }));

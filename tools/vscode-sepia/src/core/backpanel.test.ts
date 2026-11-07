import { test } from "node:test";
import assert from "node:assert/strict";
import type { Project, SheetJson } from "./types.ts";
import { buildIndex } from "./model.ts";
import { checkLayout, panelLayout, snapMount, tagRun, toSheet, unmounted } from "./backpanel.ts";
import { applySheetOp } from "./ops.ts";
import { sticks } from "./generated.ts";

// A small enclosure: 600 × 800, its backpanel 560 × 760, one rail.
function proj(sheet: SheetJson): Project {
  return {
    root: "/x",
    sepia: {},
    panel: {
      devices: [
        { tag: "ENC", part: "enc" },
        { tag: "K1", part: "contactor" },
        { tag: "K2", part: "contactor" },
        { tag: "OL1", part: "overload" },
        { tag: "VFD", part: "drive" },
        { tag: "S1", part: "selector" },
        { tag: "M1", part: "motor", field: true },
        { tag: "X", part: "nosize" },
      ],
      wires: [],
    },
    parts: {
      enc: { id: "enc", enclosure: { size_mm: [600, 800, 250] }, bom: [{ part: "enc" }, { part: "bp" }] },
      bp: { id: "bp", panel: { size_mm: [560, 760] } },
      contactor: { id: "contactor", catalog: "C9", mount: { din: "35mm", size_mm: [45, 80, 90] } },
      overload: { id: "overload", mount: { on: "contactor", size_mm: [45, 50, 90] } },
      drive: { id: "drive", catalog: "D1", mount: { backpanel: true, size_mm: [150, 250, 150], clearance_mm: { top: 50, bottom: 50 } } },
      selector: { id: "selector", mount: { door: "22mm", size_mm: [40, 60, 70] } },
      motor: { id: "motor" },
      nosize: { id: "nosize", mount: { din: "35mm" } },
    },
    sheets: [{ name: "20-layout", file: "20-layout.sheet.json", sheet: { kind: "layout", enclosure: "ENC", ...sheet } }],
    revision: { rev: "A", issued: false, date: "2026-11-07", history: [] },
    parseErrors: {},
  };
}
const rail = { id: "A", x: 20, y: 500, len: 300 };
const codes = (p: Project) => checkLayout(p, p.sheets[0], buildIndex(p)).map((x) => x.code);
const layout = (p: Project) => panelLayout(p, p.sheets[0], buildIndex(p));

test("the backpanel comes from the enclosure's bill of materials, centred", () => {
  const L = layout(proj({}));
  assert.deepEqual(L.enclosure, { tag: "ENC", w: 600, h: 800, d: 250 });
  assert.deepEqual(L.backpanel, { w: 560, h: 760, x: 20, y: 20 });
  assert.ok(SCALES_OK(L.scale));
});
const SCALES_OK = (n: number) => [4, 5, 8, 10, 12, 16, 20].includes(n);

test("a DIN part sits centred on its rail; an attached part hangs under its host", () => {
  const L = layout(proj({ din: [rail], mount: [{ device: "K1", on: "A", x: 100 }, { device: "OL1", on: "K1" }] }));
  const k1 = L.items.find((i) => i.tag === "K1")!;
  assert.deepEqual([k1.x, k1.y, k1.w, k1.h], [100, 460, 45, 80]);
  const ol = L.items.find((i) => i.tag === "OL1")!;
  assert.deepEqual([ol.x, ol.y], [100, 540]);
});

test("a clean layout checks clean", () => {
  const p = proj({ din: [rail], duct: [{ x: 20, y: 380, w: 520, h: 50 }], mount: [{ device: "K1", on: "A", x: 100 }, { device: "K2", on: "A", x: 145 }, { device: "OL1", on: "K1" }, { device: "VFD", x: 350, y: 80 }, { device: "S1", on: "door", x: 100, y: 100 }] });
  assert.deepEqual(codes(p), []);
});

test("overlap, off the rail's end and off the backpanel are errors, with the numbers", () => {
  const p = proj({ din: [rail], mount: [{ device: "K1", on: "A", x: 100 }, { device: "K2", on: "A", x: 130 }, { device: "VFD", x: 450, y: 600 }] });
  const probs = checkLayout(p, p.sheets[0], buildIndex(p));
  assert.ok(probs.some((x) => x.code === "mount-overlap" && /K1 and K2 overlap by 15 mm × 80 mm/.test(x.message)));
  assert.ok(probs.some((x) => x.code === "mount-outside" && /VFD/.test(x.message)));
  const p2 = proj({ din: [rail], mount: [{ device: "K1", on: "A", x: 290 }] });
  assert.ok(codes(p2).includes("mount-rail-end"));
});

test("a drive's clearance is kept clear of duct and parts", () => {
  const p = proj({ duct: [{ x: 300, y: 50, w: 250, h: 50 }], mount: [{ device: "VFD", x: 350, y: 120 }] });
  const msgs = checkLayout(p, p.sheets[0], buildIndex(p)).filter((x) => x.code === "mount-clearance").map((x) => x.message);
  assert.deepEqual(msgs, ["VFD needs 50 mm clear above it (D1); the duct at x 300, y 50 is 30 mm into that space"]);
});

test("wrong kind of mount, unknown rail, field device and missing size are reported", () => {
  const p = proj({ din: [rail], mount: [{ device: "K1", x: 10, y: 10 }, { device: "S1", on: "B", x: 0 }, { device: "M1", x: 300, y: 300 }, { device: "X", on: "A", x: 200 }] });
  const c = codes(p);
  for (const want of ["mount-kind", "mount-on", "mount-size", "mount-field"]) assert.ok(c.includes(want), want);
});

test("duct over a rail, and a rail off the backpanel", () => {
  const p = proj({ din: [{ id: "A", x: 20, y: 500, len: 600 }], duct: [{ x: 20, y: 490, w: 100, h: 40 }] });
  const c = codes(p);
  assert.ok(c.includes("din-outside"));
  assert.ok(c.includes("duct-overlap"));
});

test("a DIN part dropped on a rail snaps to the nearest free stretch", () => {
  const p = proj({ din: [rail], mount: [{ device: "K1", on: "A", x: 100 }] });
  const L = layout(p);
  const body = L.items.find((i) => i.tag === "K1")!;
  const at = (mmx: number, mmy: number) => {
    const s = toSheet(L, "backpanel", { x: mmx, y: mmy, w: 0, h: 0 });
    return snapMount(L, "K2", body, s.x, s.y);
  };
  // Dropped square on K1: slides to whichever side is nearer.
  assert.equal(at(125, 500)?.x, 145);
  assert.equal(at(118, 500)?.x, 55);
  // Clear rail: centred on the pointer, to the mm.
  assert.deepEqual({ ...at(250.4, 495)!, rect: undefined }, { on: "A", x: 228, rect: undefined });
  // Past the end: stops at the end.
  assert.equal(at(360, 500)?.x, 275);
  // Far from any rail: nowhere.
  assert.equal(at(250, 200), null);
});

test("a backpanel part snaps to 5 mm and stays on the backpanel; a door part to the door", () => {
  const L = layout(proj({}));
  const vfd = { kind: "backpanel" as const, w: 150, h: 250, d: 150, sized: true };
  const s = toSheet(L, "backpanel", { x: 203, y: 312, w: 0, h: 0 });
  assert.deepEqual({ ...snapMount(L, "VFD", vfd, s.x, s.y)!, rect: undefined }, { x: 130, y: 185, rect: undefined });
  const edge = toSheet(L, "backpanel", { x: 555, y: 10, w: 0, h: 0 });
  assert.deepEqual({ ...snapMount(L, "VFD", vfd, edge.x, edge.y)!, rect: undefined }, { x: 410, y: 0, rect: undefined });
  const sel = { kind: "door" as const, w: 40, h: 60, d: 70, sized: true };
  const d = toSheet(L, "door", { x: 300, y: 400, w: 0, h: 0 });
  assert.deepEqual({ ...snapMount(L, "S1", sel, d.x, d.y)!, rect: undefined }, { on: "door", x: 280, y: 370, rect: undefined });
});

test("mount and unmount ops rewrite the sheet", () => {
  const text = JSON.stringify({ kind: "layout", mount: [{ device: "K1", on: "A", x: 100 }] });
  const a = applySheetOp(text, { type: "mount", device: "K1", on: "A", x: 150 });
  assert.ok("text" in a);
  assert.deepEqual(JSON.parse(a.text).mount, [{ device: "K1", on: "A", x: 150 }]);
  const b = applySheetOp(a.text, { type: "mount", device: "VFD", x: 10, y: 20 });
  assert.ok("text" in b);
  assert.deepEqual(JSON.parse(b.text).mount[1], { device: "VFD", x: 10, y: 20 });
  const c = applySheetOp(b.text, { type: "unmount", device: "K1" });
  assert.ok("text" in c);
  assert.deepEqual(JSON.parse(c.text).mount.map((m: { device: string }) => m.device), ["VFD"]);
  assert.ok("error" in applySheetOp(c.text, { type: "unmount", device: "K1" }));
});

test("devices nobody mounted are listed once there is a layout sheet", () => {
  const p = proj({ mount: [{ device: "K1", on: "A", x: 0 }] });
  assert.deepEqual(unmounted(p, buildIndex(p)), ["K2", "OL1", "VFD", "S1", "X"]);
});

test("a run of narrow parts is labelled once", () => {
  assert.equal(tagRun(["FTB1", "FTB2", "FTB3"]), "FTB1–3");
  assert.equal(tagRun(["CB1", "CB3"]), "CB1, 3");
  assert.equal(tagRun(["CB1", "CB2", "CB3", "CB4", "CB6", "CB7", "CB8"]), "CB1–4, 6–8");
  assert.equal(tagRun(["ISR1", "ISB1"]), "ISR1, ISB1");
  assert.equal(tagRun(["TB2"]), "TB2");
});

test("rail and duct are cut from sticks, offcuts and all", () => {
  // Two 1440 verticals and five 728 horizontals from 2 m duct: 5 sticks, not 4.
  assert.equal(sticks([1440, 1440, 728, 728, 728, 728, 728], 2000), 5);
  assert.equal(sticks([2500], 1000), 3);
  assert.equal(sticks([], 1000), 0);
});

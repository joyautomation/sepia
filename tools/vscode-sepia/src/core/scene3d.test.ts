import { test } from "node:test";
import assert from "node:assert/strict";
import type { Project, SheetJson } from "./types.ts";
import { buildIndex } from "./model.ts";
import { checkDepth, panelScene, PANEL_FACE_MM, DOOR_MM } from "./scene3d.ts";

// 600 wide × 800 tall × 250 deep; the backpanel 560 × 760, inset 20, 20.
function proj(sheet: SheetJson, enc: Record<string, unknown> = {}): Project {
  return {
    root: "/x",
    sepia: {},
    panel: {
      devices: [
        { tag: "ENC", part: "enc" },
        { tag: "K1", part: "contactor" },
        { tag: "VFD", part: "drive" },
        { tag: "S1", part: "selector" },
        { tag: "AC", part: "ac" },
      ],
      wires: [],
    },
    parts: {
      enc: { id: "enc", enclosure: { size_mm: [600, 800, 250], ...enc }, bom: [{ part: "enc" }, { part: "bp" }] },
      bp: { id: "bp", panel: { size_mm: [560, 760] } },
      contactor: { id: "contactor", mount: { din: "35mm", size_mm: [45, 80, 90] } },
      drive: { id: "drive", catalog: "D1", mount: { backpanel: true, size_mm: [150, 250, 150], clearance_mm: { top: 50 } } },
      selector: { id: "selector", catalog: "SEL", mount: { door: "22mm", size_mm: [40, 60, 70] } },
      ac: { id: "ac", catalog: "AC9", mount: { outside: true, size_mm: [200, 500, 240] } },
    },
    sheets: [{ name: "20-layout", file: "20-layout.sheet.json", sheet: { kind: "layout", enclosure: "ENC", ...sheet } }],
    revision: { rev: "A", issued: false, date: "2026-11-07", history: [] },
    parseErrors: {},
  };
}
const scene = (p: Project) => panelScene(p, p.sheets[0], buildIndex(p));
const depth = (p: Project) => checkDepth(p, p.sheets[0], buildIndex(p));
const rail = { id: "A", x: 20, y: 500, len: 300 };

test("parts sit on the backpanel's face, door parts reach back from the door", () => {
  const S = scene(proj({ din: [rail], mount: [{ device: "K1", on: "A", x: 100 }, { device: "VFD", x: 350, y: 80 }, { device: "S1", on: "door", x: 100, y: 100 }] }));
  const box = (id: string) => S.boxes.find((b) => b.id === id)!;
  // Backpanel mm + the 20 mm inset; rail centred on y 500.
  assert.deepEqual([box("part:K1").x, box("part:K1").y, box("part:K1").z], [120, 480, PANEL_FACE_MM]);
  assert.deepEqual([box("part:VFD").x, box("part:VFD").y, box("part:VFD").on], [370, 100, "inside"]);
  // The door's inside is at 250 − 2; the selector reaches 70 back from it.
  assert.deepEqual([box("part:S1").x, box("part:S1").z, box("part:S1").on], [100, 250 - DOOR_MM - 70, "door"]);
  // The drive's clearance box grows up by 50.
  assert.deepEqual([box("clear:VFD").y, box("clear:VFD").h], [50, 300]);
  assert.equal(box("rail:A").d, 7.5);
  assert.match(box("part:S1").label!, /^S1\n/);
});

test("nothing deep in front of the door's operators checks clean", () => {
  const p = proj({ din: [rail], mount: [{ device: "K1", on: "A", x: 100 }, { device: "S1", on: "door", x: 300, y: 600 }] });
  assert.deepEqual(depth(p), []);
});

test("a door operator that hits the part behind it is an error, with the arithmetic", () => {
  // The selector at door (380, 150) is in front of the drive (backpanel 350..500, 80..330 → 370..520, 100..350).
  const p = proj({ mount: [{ device: "VFD", x: 350, y: 80 }, { device: "S1", on: "door", x: 400, y: 150 }] });
  // Room: 250 − 21 − 2 = 227; 227 − 70 − 150 = 7 left: a warning.
  assert.deepEqual(
    depth(p).map((x) => [x.severity, x.code, x.message]),
    [["warning", "door-depth", "S1 reaches 70 mm behind the door and VFD stands 150 mm off the backpanel; with 227 mm between the backpanel and the door, 7 mm is left (keep 13 mm)"]],
  );
  // A thinner enclosure (200 deep): 177 − 220 = −43.
  const thin = proj({ mount: [{ device: "VFD", x: 350, y: 80 }, { device: "S1", on: "door", x: 400, y: 150 }] }, { size_mm: [600, 800, 200] });
  assert.ok(depth(thin).some((x) => x.code === "door-depth" && x.severity === "error" && /won't close: 43 mm too much/.test(x.message)));
});

test("a part deeper than the enclosure is an error", () => {
  const p = proj({ mount: [{ device: "VFD", x: 350, y: 80 }] }, { size_mm: [600, 800, 160] });
  const m = depth(p).find((x) => x.code === "mount-depth")!;
  assert.equal(m.message, "VFD stands 150 mm off the backpanel (D1); there is 137 mm between the backpanel and the door (160 mm deep less 21 mm to the backpanel's face and 2 mm of door)");
});

test("a side unit wider than the flat of the side warns, until the part says the flat", () => {
  const p = proj({ mount: [{ device: "AC", on: "right", y: 100 }] });
  const w = depth(p);
  assert.equal(w.length, 1);
  assert.match(w[0].message, /^AC's mounting face is 240 mm across \(AC9\); the side has 220 mm flat \(250 mm deep less about 30 mm/);
  assert.deepEqual(depth(proj({ mount: [{ device: "AC", on: "right", y: 100 }] }, { side_flat_mm: 245 })), []);
  // It sits outside, centred on the side's depth.
  const ac = scene(p).boxes.find((b) => b.id === "part:AC")!;
  assert.deepEqual([ac.x, ac.z, ac.on], [600, 5, "outside"]);
});

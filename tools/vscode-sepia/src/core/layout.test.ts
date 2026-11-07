import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { Project, Revision } from "./types.ts";
import { buildIndex, resolvePart } from "./model.ts";
import { layoutSheet, type LadderLayout } from "./ladder.ts";
import { check } from "./check.ts";

// The example on disk is the fixture (see print.test.ts).
const require = createRequire(import.meta.url);
const { loadProject } = require("../../out/load.js") as { loadProject: (root: string, rev: Revision) => Project };
const root = new URL("../../../../examples/lift-station", import.meta.url).pathname;
const p = loadProject(root, { rev: "A", issued: false, date: "2026-11-07", history: [] });
const ix = buildIndex(p);
const layout = (name: string): LadderLayout => layoutSheet(p, p.sheets.find((s) => s.name === name)!, ix);

test("the example checks clean apart from the SCCR lesson", () => {
  const probs = check(p).filter((x) => x.severity !== "info");
  assert.deepEqual(probs.map((x) => x.code), ["sccr"]);
  assert.match(probs[0].message, /GH15ET|gh15et/);
});

test("every wire end in the example is drawn somewhere", () => {
  assert.deepEqual(check(p).filter((x) => x.code === "term-undrawn").map((x) => x.message), []);
});

test("power: poles that line up drop straight down", () => {
  const L = layout("01-power");
  const runs = L.segs.filter((s) => s.wire === "103U");
  assert.equal(runs.length, 1);
  assert.equal(runs[0].x1, runs[0].x2);
});

test("power: the bus runs on tracks, L1 above L2 above L3", () => {
  const L = layout("01-power");
  const trackY = (w: string) => L.segs.find((s) => s.wire === w && s.y1 === s.y2)!.y1;
  assert.ok(trackY("100L1") < trackY("100L2") && trackY("100L2") < trackY("100L3"));
  // Every branch fuse taps the bus with a dot.
  assert.ok(L.dots.filter((d) => d.wire === "100L1").length >= 6);
});

test("power: the bypass rejoins the motor leads at a junction", () => {
  const L = layout("01-power");
  const m = L.pieces.find((pc) => pc.ref === "M101A.power")!;
  const t1 = m.ports.find((pt) => pt.term === "M101A:2/T1")!;
  assert.ok(L.dots.some((d) => d.wire === "103T1" && d.x === t1.x));
});

test("ladder: a branch gets a dot, a plain two-port run doesn't", () => {
  const io = layout("06-inputs-pumps");
  assert.equal(io.dots.filter((d) => d.wire === "600").length, 1);
  const dc = layout("05-dc-power");
  assert.equal(dc.dots.filter((d) => d.wire === "503" || d.wire === "503A").length, 0);
});

test("a wire that is another sheet's rail points at that sheet", () => {
  const L = layout("02-control-power");
  assert.equal(L.stubs.find((s) => s.wire === "211")?.to, "SHEET 3");
});

test("assemblies take their base's pieces and add their own", () => {
  const hoa = resolvePart(p.parts, "asm/hoa-gold")!;
  assert.deepEqual(Object.keys(hoa.pieces!).sort(), ["left", "left-g", "right", "right-g"]);
  const q1 = resolvePart(p.parts, "asm/main-disconnect")!;
  assert.equal((q1.ratings as { sccr: { ka: number }[] }).sccr[0].ka, 200);
});

test("repeated pieces are spelled out", () => {
  const di = resolvePart(p.parts, "moxa/45mr-1600")!;
  assert.equal(Object.keys(di.pieces!).length, 16);
  assert.deepEqual(di.pieces!.di15.terminals, ["DI15"]);
});

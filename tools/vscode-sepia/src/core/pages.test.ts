import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { Project, Revision } from "./types.ts";
import { buildIndex } from "./model.ts";
import { conductors, numberedWires } from "./conductors.ts";
import { bom, setIndex } from "./generated.ts";
import { layoutSheet } from "./ladder.ts";
import { check } from "./check.ts";

const require = createRequire(import.meta.url);
const { loadProject } = require("../../out/load.js") as { loadProject: (root: string, rev: Revision) => Project };
const root = new URL("../../../../examples/lift-station", import.meta.url).pathname;
const load = () => loadProject(root, { rev: "A", issued: false, date: "2026-11-07", history: [] });
const fromTo = (p: Project): Project => ({ ...p, sepia: { ...p.sepia, numbering: { default: "from-to", field: "from-to" } } });

test("a run of n terminals is n - 1 conductors", () => {
  const p = load();
  const cs = conductors(p, buildIndex(p)).filter((c) => c.wire.no === "302");
  assert.deepEqual(cs.map((c) => [c.from, c.to]), [["SS101:4", "CR101:14"], ["CR101:14", "SS102:3"], ["SS102:3", "SS102:13"]]);
});

test("line inside, from-to in the field (the example's numbering)", () => {
  const p = load();
  const cs = conductors(p, buildIndex(p));
  const inside = cs.find((c) => c.from === "M101A:2/T1")!;
  assert.equal(inside.scheme, "line");
  assert.deepEqual([inside.markFrom, inside.markTo], ["103T1", "103T1"]);
  const field = cs.find((c) => c.to === "P-101:T1")!;
  assert.equal(field.scheme, "from-to");
  assert.deepEqual([field.markFrom, field.markTo], ["P-101:T1", "OL101:2/T1"]);
});

test("from-to inside too: no wire numbers printed, far ends instead, no numbering warnings", () => {
  const p = fromTo(load());
  const ix = buildIndex(p);
  assert.equal(numberedWires(conductors(p, ix)).size, 0);
  const L = layoutSheet(p, p.sheets.find((s) => s.name === "03-pump-1-control")!, ix);
  assert.ok(!L.labels.some((l) => l.text === "302A"));
  assert.ok(L.labels.some((l) => l.text === "M101B:21")); // the sleeve at SS102:4
  assert.ok(!check(p).some((x) => x.code === "wire-numbering"));
});

test("the BOM expands assemblies and totals by part", () => {
  const lines = bom(load());
  const q = (cat: string) => lines.find((l) => l.part?.catalog === cat)?.qty;
  assert.equal(q("JDL70"), 3);
  assert.equal(q("HT8E"), 5); // two per HOA, one in the reset button
  assert.equal(q("DN-T12-A"), 28);
  assert.ok(lines.find((l) => l.part?.catalog?.startsWith("Waterpilot"))!.field);
});

test("the cover isn't numbered, so the power sheet is sheet 1", () => {
  const p = load();
  const set = setIndex(p, buildIndex(p));
  assert.equal(set.pages[0].number, undefined);
  assert.equal(set.pages.find((sp) => sp.sheet.name === "01-power")!.number, 1);
  assert.ok(set.pages.filter((sp) => sp.sheet.name === "11-wires").length >= 2);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { Project, Revision } from "./types.ts";
import { printName, printSet } from "./print.ts";

// The loader is node-only and lives outside core; the example on disk is
// the fixture. The revision is passed in, so git state doesn't matter.
const require = createRequire(import.meta.url);
const { loadProject } = require("../../out/load.js") as { loadProject: (root: string, rev: Revision) => Project };
const root = new URL("../../../../examples/lift-station", import.meta.url).pathname;

const latin1 = (b: Uint8Array) => Buffer.from(b).toString("latin1");

test("a draft prints every sheet, stamped PRELIMINARY", () => {
  const p = loadProject(root, { rev: "A", issued: false, date: "2026-11-06", commit: "abc1234", history: [] });
  const pdf = latin1(printSet(p));
  assert.ok(pdf.startsWith("%PDF-1.4"));
  assert.equal(pdf.match(/\/Type \/Page /g)?.length, p.sheets.length);
  assert.ok(pdf.includes("PRELIMINARY"));
  assert.equal(printName(p), "LS1-E-A-draft.pdf");
});

test("an issued revision has no stamp and fills the revision block", () => {
  const rev = { rev: "A", issued: true, date: "2026-11-06", history: [{ rev: "A", date: "2026-11-06", desc: "Issued for review" }] };
  const p = loadProject(root, rev);
  const pdf = latin1(printSet(p));
  assert.ok(!pdf.includes("PRELIMINARY"));
  assert.ok(pdf.includes("(Issued for review)"));
  assert.equal(printName(p), "LS1-E-A.pdf");
});

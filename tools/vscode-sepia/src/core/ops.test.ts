import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applySheetOp } from "./ops.ts";
import { formatJson, minimalEdit } from "./format.ts";

const sheetText = readFileSync(new URL("../../../../examples/lift-station/sheets/01-pump-1-control.sheet.json", import.meta.url), "utf8");

test("the example sheet is already canonical", () => {
  assert.equal(formatJson(JSON.parse(sheetText)), sheetText);
});

test("a move is a one-line edit", () => {
  const r = applySheetOp(sheetText, { type: "move", piece: "OL101.nc", line: 306, col: 5 });
  assert.ok("text" in r);
  const e = minimalEdit(sheetText, r.text)!;
  assert.ok(!e.text.includes("\n"), e.text);
});

test("a move onto a taken cell is refused", () => {
  const r = applySheetOp(sheetText, { type: "move", piece: "OL101.nc", line: 302, col: 1 });
  assert.ok("error" in r);
});

test("place then unplace round-trips", () => {
  const r = applySheetOp(sheetText, { type: "place", piece: "CR101.no2", line: 310, col: 3 });
  assert.ok("text" in r);
  const back = applySheetOp(r.text, { type: "unplace", piece: "CR101.no2" });
  assert.ok("text" in back);
  assert.equal(back.text, sheetText);
});

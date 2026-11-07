// Render a sheet outside VS Code: writes media/dist/harness-<sheet>.html
// with the project inlined, for a browser or a headless screenshot.
//   node scripts/harness.mjs ../../examples/lift-station [sheet-name]
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import * as path from "node:path";

const require = createRequire(import.meta.url);
const { findRoot, loadProject } = require("../out/load.js");
const { revisionOf } = require("../out/rev.js");
const { check } = require("../out/core/check.js");

const root = findRoot(path.resolve(process.argv[2] ?? "."));
const project = loadProject(root, revisionOf(root));
const names = process.argv[3] ? [process.argv[3]] : project.sheets.map((s) => s.name);
for (const sheet of names) {
  const msg = { type: "project", sheet, project, problems: check(project) };
  const out = path.resolve("media/dist", `harness-${sheet}.html`);
  writeFileSync(out, `<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="sheet.css">
<style>:root{--vscode-editor-background:#1f1f1f;--vscode-sideBar-background:#181818;--vscode-foreground:#ccc}</style></head>
<body><div id="app"></div><script>window.__SEPIA__=${JSON.stringify(msg)}</script><script src="sheet.js"></script></body></html>`);
  console.log(out);
}

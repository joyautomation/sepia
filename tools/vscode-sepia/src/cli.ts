#!/usr/bin/env node
// sepia CLI.
//
//   sepia check [dir] [--json]     every problem; exit 1 on any error
//   sepia print [dir] [-o out.pdf] the drawing set as one PDF
//
// `check` is the one an agent runs after every edit.

import * as fs from "node:fs";
import * as path from "node:path";
import { check } from "./core/check.ts";
import { printName, printSet } from "./core/print.ts";
import { findRoot, loadProject } from "./load.ts";
import { revisionOf } from "./rev.ts";

const USAGE = "usage: sepia check [dir] [--json]\n       sepia print [dir] [-o file.pdf]\n";

function main(argv: string[]): number {
  const [cmd, ...rest] = argv;
  if (cmd !== "check" && cmd !== "print") {
    process.stderr.write(USAGE);
    return 2;
  }
  const oi = rest.indexOf("-o");
  const outArg = oi >= 0 ? rest[oi + 1] : undefined;
  const positional = rest.filter((a, i) => !a.startsWith("-") && !(oi >= 0 && i === oi + 1));
  const dir = path.resolve(positional[0] ?? ".");
  const root = findRoot(dir);
  if (!root) {
    process.stderr.write(`no sepia.json at or above ${dir}\n`);
    return 2;
  }
  const project = loadProject(root, revisionOf(root));

  if (cmd === "print") {
    const out = path.resolve(outArg ?? path.join(root, printName(project)));
    fs.writeFileSync(out, printSet(project));
    const r = project.revision;
    process.stdout.write(`${out}: ${project.sheets.length} sheets, rev ${r.rev}${r.issued ? "" : " draft (PRELIMINARY)"}\n`);
    return 0;
  }

  const problems = check(project);
  if (rest.includes("--json")) process.stdout.write(JSON.stringify({ root, problems }, null, 2) + "\n");
  else {
    for (const p of problems) process.stdout.write(`${p.file}: ${p.severity}: ${p.message} [${p.code}]\n`);
    const n = (s: string) => problems.filter((p) => p.severity === s).length;
    process.stdout.write(`${n("error")} errors, ${n("warning")} warnings, ${n("info")} notes\n`);
  }
  return problems.some((p) => p.severity === "error") ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));

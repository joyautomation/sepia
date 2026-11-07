#!/usr/bin/env node
// sepia CLI. For now one command, the one an agent needs after every edit:
//
//   sepia check [dir] [--json]
//
// Exit status 1 when there is any error, so an agent (or CI) can loop on it.

import * as path from "node:path";
import { check } from "./core/check.ts";
import { findRoot, loadProject } from "./load.ts";
import { revisionOf } from "./rev.ts";

function main(argv: string[]): number {
  const [cmd, ...rest] = argv;
  if (cmd !== "check") {
    process.stderr.write("usage: sepia check [dir] [--json]\n");
    return 2;
  }
  const json = rest.includes("--json");
  const dir = path.resolve(rest.find((a) => !a.startsWith("--")) ?? ".");
  const root = findRoot(dir);
  if (!root) {
    process.stderr.write(`no sepia.json at or above ${dir}\n`);
    return 2;
  }
  const problems = check(loadProject(root, revisionOf(root)));
  if (json) process.stdout.write(JSON.stringify({ root, problems }, null, 2) + "\n");
  else {
    for (const p of problems) process.stdout.write(`${p.file}: ${p.severity}: ${p.message} [${p.code}]\n`);
    const n = (s: string) => problems.filter((p) => p.severity === s).length;
    process.stdout.write(`${n("error")} errors, ${n("warning")} warnings, ${n("info")} notes\n`);
  }
  return problems.some((p) => p.severity === "error") ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));

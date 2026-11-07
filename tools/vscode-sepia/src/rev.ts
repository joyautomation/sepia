// Revisions from git tags (docs/design.md §3.4): HEAD exactly at rev-B is
// revision B, issued. Anything else is a draft of the next letter, stamped
// PRELIMINARY, with the commit.

import { execFileSync } from "node:child_process";
import type { Revision } from "./core/types.ts";

function git(cwd: string, args: string[]): string | undefined {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined;
  }
}

function nextLetter(rev: string | undefined): string {
  if (!rev) return "A";
  const c = rev.charCodeAt(rev.length - 1);
  return rev.slice(0, -1) + String.fromCharCode(c + 1);
}

export function revisionOf(root: string): Revision {
  const today = new Date().toISOString().slice(0, 10);
  const tags = (git(root, ["tag", "--list", "rev-*", "--sort=creatordate", "--format=%(refname:short)\t%(creatordate:short)\t%(contents:subject)"]) ?? "")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [tag, date, desc] = l.split("\t");
      return { rev: tag.replace(/^rev-/, ""), date, desc: desc ?? "" };
    });
  const exact = git(root, ["describe", "--tags", "--exact-match", "--match", "rev-*", "HEAD"]);
  const commit = git(root, ["rev-parse", "--short", "HEAD"]);
  const dirty = !!git(root, ["status", "--porcelain", "--", "."]);
  if (exact && !dirty) {
    const rev = exact.replace(/^rev-/, "");
    return { rev, issued: true, date: tags.find((t) => t.rev === rev)?.date ?? today, commit, history: tags };
  }
  return {
    rev: nextLetter(tags[tags.length - 1]?.rev),
    issued: false,
    date: today,
    commit: commit ? commit + (dirty ? "+" : "") : undefined,
    history: tags,
  };
}

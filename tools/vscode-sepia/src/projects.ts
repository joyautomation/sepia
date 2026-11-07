// One live view of each sepia project in the workspace: its files watched,
// re-read on any change (saved or not), checked, and pushed to every open
// sheet editor of that project and to the Problems panel.

import * as path from "node:path";
import * as vscode from "vscode";
import { check } from "./core/check.ts";
import type { Problem, Project } from "./core/types.ts";
import { findRoot, loadProject } from "./load.ts";
import { revisionOf } from "./rev.ts";

const DEBOUNCE_MS = 120;

export type Snapshot = { project: Project; problems: Problem[] };

class LiveProject {
  private timer: NodeJS.Timeout | undefined;
  private readonly subs: vscode.Disposable[] = [];
  private readonly listeners = new Set<(s: Snapshot) => void>();
  snapshot: Snapshot;

  constructor(readonly root: string, private readonly diags: vscode.DiagnosticCollection) {
    this.snapshot = this.read();
    const w = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(root, "{sepia.json,panel.json,parts/**/*.json,sheets/**/*.sheet.json}")
    );
    const kick = () => this.schedule();
    this.subs.push(w, w.onDidChange(kick), w.onDidCreate(kick), w.onDidDelete(kick));
    this.subs.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (this.owns(e.document.uri)) this.schedule();
      }),
      vscode.workspace.onDidCloseTextDocument((d) => {
        if (this.owns(d.uri)) this.schedule();
      })
    );
    void this.publish();
  }

  private owns(uri: vscode.Uri): boolean {
    return uri.scheme === "file" && uri.fsPath.endsWith(".json") && !path.relative(this.root, uri.fsPath).startsWith("..");
  }

  private read(): Snapshot {
    // Unsaved edits count: an agent or a person typing in panel.json sees
    // the sheet change before saving.
    const overlay = new Map<string, string>();
    for (const d of vscode.workspace.textDocuments) if (this.owns(d.uri)) overlay.set(d.uri.fsPath, d.getText());
    const project = loadProject(this.root, revisionOf(this.root), overlay);
    return { project, problems: check(project) };
  }

  schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.refresh(), DEBOUNCE_MS);
  }

  refresh(): void {
    this.snapshot = this.read();
    for (const l of this.listeners) l(this.snapshot);
    void this.publish();
  }

  onChange(l: (s: Snapshot) => void): vscode.Disposable {
    this.listeners.add(l);
    return new vscode.Disposable(() => this.listeners.delete(l));
  }

  /** Problems → diagnostics, each placed on the first occurrence of its
   * `find` text in its file. */
  private async publish(): Promise<void> {
    const byFile = new Map<string, Problem[]>();
    for (const p of this.snapshot.problems) byFile.set(p.file, [...(byFile.get(p.file) ?? []), p]);
    const files = new Set([...byFile.keys(), ...this.published]);
    this.published = new Set(byFile.keys());
    for (const file of files) {
      const uri = vscode.Uri.file(path.join(this.root, file));
      const list = byFile.get(file) ?? [];
      let text = "";
      try {
        text = (await vscode.workspace.openTextDocument(uri)).getText();
      } catch {
        /* deleted */
      }
      this.diags.set(
        uri,
        list.map((p) => {
          const at = p.find ? text.indexOf(p.find) : -1;
          const range = at >= 0 ? rangeOf(text, at, p.find!.length) : new vscode.Range(0, 0, 0, 0);
          const d = new vscode.Diagnostic(range, p.message, SEVERITY[p.severity]);
          d.source = "sepia";
          d.code = p.code;
          return d;
        })
      );
    }
  }
  private published = new Set<string>();

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    for (const s of this.subs) s.dispose();
    for (const file of this.published) this.diags.delete(vscode.Uri.file(path.join(this.root, file)));
  }
}

const SEVERITY = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  info: vscode.DiagnosticSeverity.Information,
};

function rangeOf(text: string, offset: number, len: number): vscode.Range {
  const before = text.slice(0, offset);
  const line = before.split("\n").length - 1;
  const col = offset - (before.lastIndexOf("\n") + 1);
  return new vscode.Range(line, col, line, col + len);
}

export class Projects implements vscode.Disposable {
  private readonly live = new Map<string, LiveProject>();
  readonly diags = vscode.languages.createDiagnosticCollection("sepia");

  /** The live project owning a file, started on first use. */
  forFile(fsPath: string): LiveProject | undefined {
    const root = findRoot(fsPath);
    if (!root) return undefined;
    let lp = this.live.get(root);
    if (!lp) {
      lp = new LiveProject(root, this.diags);
      this.live.set(root, lp);
    }
    return lp;
  }

  /** Start every project in the workspace, so Problems is filled before
   * any sheet is opened. */
  async discover(): Promise<number> {
    const found = await vscode.workspace.findFiles("**/sepia.json", "**/node_modules/**");
    for (const f of found) this.forFile(f.fsPath)?.refresh();
    return found.length;
  }

  dispose(): void {
    for (const lp of this.live.values()) lp.dispose();
    this.diags.dispose();
  }
}

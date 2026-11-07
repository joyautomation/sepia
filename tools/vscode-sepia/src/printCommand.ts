// "sepia: Print to PDF": the whole drawing set, saved through the save
// dialog (which also works over Remote-SSH, where opening a local PDF
// viewer doesn't), named by drawing number and revision.

import * as path from "node:path";
import * as vscode from "vscode";
import { printName, printSet } from "./core/print.ts";
import { findRoot } from "./load.ts";
import type { Projects } from "./projects.ts";

/** The project to print: the given one, the active sheet's, or the only
 * (or a picked) project in the workspace. */
async function pickRoot(projects: Projects, root?: string): Promise<string | undefined> {
  if (root) return root;
  const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
  const uri = input instanceof vscode.TabInputCustom || input instanceof vscode.TabInputText ? input.uri : undefined;
  const fromTab = uri && uri.scheme === "file" ? findRoot(uri.fsPath) : undefined;
  if (fromTab) return fromTab;
  const roots = (await vscode.workspace.findFiles("**/sepia.json", "**/node_modules/**")).map((u) => path.dirname(u.fsPath));
  if (roots.length <= 1) return roots[0];
  return vscode.window.showQuickPick(roots, { placeHolder: "Which sepia project?" });
}

export async function printToPdf(projects: Projects, root?: string): Promise<void> {
  root = await pickRoot(projects, root);
  if (!root) {
    void vscode.window.showInformationMessage("sepia: no sepia.json in this workspace");
    return;
  }
  // The print is what's on disk (that's what git revisions describe), so
  // unsaved project files get saved first, with a yes.
  const dirty = vscode.workspace.textDocuments.filter((d) => d.isDirty && d.uri.scheme === "file" && !path.relative(root!, d.uri.fsPath).startsWith(".."));
  if (dirty.length) {
    const names = dirty.map((d) => path.relative(root!, d.uri.fsPath)).join(", ");
    const ok = await vscode.window.showWarningMessage(`sepia: ${names} has unsaved changes.`, { modal: true }, "Save and Print");
    if (ok !== "Save and Print") return;
    for (const d of dirty) await d.save();
  }
  const live = projects.forFile(path.join(root, "sepia.json"))!;
  live.refresh();
  const p = live.snapshot.project;
  const target = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(path.join(root, printName(p))),
    filters: { PDF: ["pdf"] },
    saveLabel: "Print",
  });
  if (!target) return;
  await vscode.workspace.fs.writeFile(target, printSet(p));
  const r = p.revision;
  const what = `${p.sheets.length} sheets, rev ${r.rev}${r.issued ? "" : " draft (PRELIMINARY)"}`;
  const pick = await vscode.window.showInformationMessage(`sepia: printed ${path.basename(target.fsPath)}: ${what}`, "Reveal");
  if (pick === "Reveal") void vscode.commands.executeCommand("revealInExplorer", target);
}

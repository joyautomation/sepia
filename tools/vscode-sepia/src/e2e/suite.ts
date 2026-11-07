// Runs inside the extension host (see run.ts).

import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

const ws = process.env.SEPIA_E2E_WS!;
const shot = process.env.SEPIA_E2E_SHOT;

async function until<T>(what: string, f: () => T | undefined, ms = 15000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = f();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

const codes = (file: string) =>
  vscode.languages.getDiagnostics(vscode.Uri.file(path.join(ws, file))).map((d) => String(typeof d.code === "object" ? d.code.value : d.code));

export async function run(): Promise<void> {
  const ext = vscode.extensions.getExtension("joyauto.sepia");
  if (!ext) throw new Error("extension not found");
  await ext.activate();
  console.log("activated");

  // Problems: the SCCR check on sepia.json, before any sheet is open.
  await until("sccr diagnostic", () => codes("sepia.json").includes("sccr"));
  console.log("ok: SCCR diagnostic on sepia.json");

  // The sheet opens in the custom editor.
  const sheet = vscode.Uri.file(path.join(ws, "sheets", "01-pump-1-control.sheet.json"));
  await vscode.commands.executeCommand("vscode.openWith", sheet, "sepia.sheetEditor");
  await until("custom editor tab", () =>
    vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof vscode.TabInputCustom ? true : undefined
  );
  console.log("ok: sheet opened in sepia.sheetEditor");

  // An unsaved edit to panel.json is seen live: renumber 302A against the rule.
  const panelDoc = await vscode.workspace.openTextDocument(path.join(ws, "panel.json"));
  const at = panelDoc.getText().indexOf('"no": "302A"');
  const edit = new vscode.WorkspaceEdit();
  edit.replace(panelDoc.uri, new vscode.Range(panelDoc.positionAt(at), panelDoc.positionAt(at + 12)), '"no": "399"');
  await vscode.workspace.applyEdit(edit);
  await until("wire-numbering diagnostic", () => codes("panel.json").includes("wire-numbering"));
  console.log("ok: live wire-numbering diagnostic after an unsaved panel.json edit");
  const back = new vscode.WorkspaceEdit();
  const at2 = panelDoc.getText().indexOf('"no": "399"');
  back.replace(panelDoc.uri, new vscode.Range(panelDoc.positionAt(at2), panelDoc.positionAt(at2 + 11)), '"no": "302A"');
  await vscode.workspace.applyEdit(back);
  await until("diagnostic cleared", () => (!codes("panel.json").includes("wire-numbering") ? true : undefined));
  console.log("ok: cleared after undoing the edit");

  if (shot) {
    await vscode.commands.executeCommand("vscode.openWith", sheet, "sepia.sheetEditor");
    await vscode.commands.executeCommand("workbench.action.closeOtherEditors");
    await new Promise((r) => setTimeout(r, 2500));
    fs.writeFileSync(path.join(shot, "ready"), "");
    await until("screenshot", () => (fs.existsSync(path.join(shot, "done")) ? true : undefined), 60000);
  }
}

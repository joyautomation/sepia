// "sepia: Show Panel in 3D": a layout sheet as boxes in a webview beside
// the editor. It edits nothing. It follows the live project, so a drag on
// the layout sheet, or an agent's edit to the JSON, moves the box too.

import * as path from "node:path";
import * as vscode from "vscode";
import { findRoot } from "./load.ts";
import type { Projects, Snapshot } from "./projects.ts";
import { SheetEditorProvider } from "./sheetEditor.ts";

function html(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const js = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "dist", "view3d.js"));
  const css = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "dist", "view3d.css"));
  const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data: blob:; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${css}">
<title>sepia 3D</title>
</head>
<body>
<div id="app"></div>
<script nonce="${nonce}" src="${js}"></script>
</body>
</html>`;
}

export class View3D {
  private readonly open = new Map<string, vscode.WebviewPanel>();

  constructor(private readonly context: vscode.ExtensionContext, private readonly projects: Projects) {}

  /** Show `sheet` of the project at `root`, or the active layout sheet,
   * or a picked one. */
  async show(root?: string, sheet?: string): Promise<void> {
    if (!root || !sheet) {
      const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
      const uri = input instanceof vscode.TabInputCustom || input instanceof vscode.TabInputText ? input.uri : undefined;
      if (uri?.fsPath.endsWith(".sheet.json")) {
        root = findRoot(uri.fsPath);
        sheet = path.basename(uri.fsPath).replace(/\.sheet\.json$/, "");
      }
    }
    if (!root || !sheet || !this.isLayout(root, sheet)) {
      await this.projects.discover();
      const found = (await vscode.workspace.findFiles("**/sepia.json", "**/node_modules/**")).map((u) => path.dirname(u.fsPath));
      const choices = found.flatMap((r) =>
        (this.projects.forFile(path.join(r, "sepia.json"))?.snapshot.project.sheets ?? [])
          .filter((s) => s.sheet.kind === "layout")
          .map((s) => ({ label: s.sheet.title ?? s.name, description: path.basename(r), root: r, sheet: s.name })),
      );
      const pick = choices.length === 1 ? choices[0] : await vscode.window.showQuickPick(choices, { placeHolder: "Which layout sheet?" });
      if (!pick) {
        if (!choices.length) void vscode.window.showInformationMessage("sepia: no layout sheet in this workspace");
        return;
      }
      root = pick.root;
      sheet = pick.sheet;
    }
    const key = `${root}\0${sheet}`;
    const existing = this.open.get(key);
    if (existing) {
      existing.reveal(vscode.ViewColumn.Beside);
      return;
    }
    const live = this.projects.forFile(path.join(root, "sepia.json"));
    if (!live) return;
    const panel = vscode.window.createWebviewPanel("sepia.view3d", `${sheet} · 3D`, vscode.ViewColumn.Beside, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "media")],
    });
    this.open.set(key, panel);
    panel.webview.html = html(panel.webview, this.context.extensionUri);
    let ready = false;
    const post = (s: Snapshot) => {
      if (ready) void panel.webview.postMessage({ type: "project", sheet, project: s.project, problems: s.problems });
    };
    const liveSub = live.onChange(post);
    const msgSub = panel.webview.onDidReceiveMessage((msg: { type?: string; file?: string }) => {
      if (msg?.type === "ready") {
        ready = true;
        post(live.snapshot);
      } else if (msg?.type === "reveal" && msg.file) {
        void vscode.window.showTextDocument(vscode.Uri.file(path.join(root!, msg.file)), { viewColumn: vscode.ViewColumn.Beside });
      } else if (msg?.type === "openSheet" && msg.file) {
        void vscode.commands.executeCommand("vscode.openWith", vscode.Uri.file(path.join(root!, "sheets", msg.file)), SheetEditorProvider.viewType, vscode.ViewColumn.One);
      }
    });
    panel.onDidDispose(() => {
      this.open.delete(key);
      liveSub.dispose();
      msgSub.dispose();
    });
  }

  private isLayout(root: string, sheet: string): boolean {
    const s = this.projects.forFile(path.join(root, "sepia.json"))?.snapshot.project.sheets.find((x) => x.name === sheet);
    return s?.sheet.kind === "layout";
  }
}

// The sheet editor: a *.sheet.json opens as a drawing. The text stays the
// source of truth. A drag becomes an op (core/ops.ts) applied as a minimal
// WorkspaceEdit, so undo works and the JSON can be edited side by side; a
// change to panel.json, a part or another sheet redraws it live.

import * as path from "node:path";
import * as vscode from "vscode";
import { minimalEdit } from "./core/format.ts";
import { applySheetOp, type SheetOp } from "./core/ops.ts";
import type { Projects, Snapshot } from "./projects.ts";

function html(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const js = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "dist", "sheet.js"));
  const css = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "dist", "sheet.css"));
  const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${css}">
<title>sepia sheet</title>
</head>
<body>
<div id="app"></div>
<script nonce="${nonce}" src="${js}"></script>
</body>
</html>`;
}

export class SheetEditorProvider implements vscode.CustomTextEditorProvider {
  static readonly viewType = "sepia.sheetEditor";
  private opQueue: Promise<void> = Promise.resolve();
  private readonly log = vscode.window.createOutputChannel("sepia");

  constructor(private readonly context: vscode.ExtensionContext, private readonly projects: Projects) {}

  register(): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(SheetEditorProvider.viewType, this, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: true,
    });
  }

  async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
    panel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "media")] };
    panel.webview.html = html(panel.webview, this.context.extensionUri);

    const live = this.projects.forFile(document.uri.fsPath);
    const sheetName = path.basename(document.uri.fsPath).replace(/\.sheet\.json$/, "");
    let ready = false;
    const post = (s: Snapshot | undefined) => {
      if (!ready) return;
      if (!s) {
        void panel.webview.postMessage({ type: "noProject", file: document.uri.fsPath });
        return;
      }
      void panel.webview.postMessage({ type: "project", sheet: sheetName, project: s.project, problems: s.problems });
    };
    const liveSub = live?.onChange(post);

    const msgSub = panel.webview.onDidReceiveMessage((msg: { type?: string; op?: SheetOp; file?: string; find?: string; text?: string }) => {
      if (msg?.type === "ready") {
        ready = true;
        post(live?.snapshot);
        return;
      }
      if (msg?.type === "reopenAsText") {
        void vscode.commands.executeCommand("vscode.openWith", document.uri, "default");
        return;
      }
      if (msg?.type === "reveal" && live && msg.file) {
        void this.reveal(path.join(live.root, msg.file), msg.find);
        return;
      }
      if (msg?.type === "openSheet" && live && msg.file) {
        const uri = vscode.Uri.file(path.join(live.root, "sheets", msg.file));
        void vscode.commands.executeCommand("vscode.openWith", uri, SheetEditorProvider.viewType);
        return;
      }
      if (msg?.type === "warn" && msg.text) {
        void vscode.window.showWarningMessage("sepia: " + msg.text);
        return;
      }
      if (msg?.type !== "op" || !msg.op) return;
      const op = msg.op;
      this.opQueue = this.opQueue
        .then(async () => {
          this.log.appendLine("op " + JSON.stringify(op));
          const before = document.getText();
          const res = applySheetOp(before, op);
          if ("error" in res) {
            void vscode.window.showWarningMessage("sepia: " + res.error);
            live?.refresh(); // snap the optimistic drag back
            return;
          }
          const e = minimalEdit(before, res.text);
          if (!e) return;
          const edit = new vscode.WorkspaceEdit();
          edit.replace(document.uri, new vscode.Range(document.positionAt(e.start), document.positionAt(e.end)), e.text);
          await vscode.workspace.applyEdit(edit);
          live?.refresh();
        })
        .catch((err) => this.log.appendLine("op failed: " + String(err)));
    });

    panel.onDidDispose(() => {
      liveSub?.dispose();
      msgSub.dispose();
    });
  }

  /** Open a project file beside the drawing, at the first `find`. */
  private async reveal(file: string, find?: string): Promise<void> {
    const doc = await vscode.workspace.openTextDocument(file);
    const at = find ? doc.getText().indexOf(find) : -1;
    const pos = at >= 0 ? doc.positionAt(at) : new vscode.Position(0, 0);
    const sel = at >= 0 ? new vscode.Selection(pos, doc.positionAt(at + find!.length)) : new vscode.Selection(pos, pos);
    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, selection: sel, preserveFocus: false });
  }
}

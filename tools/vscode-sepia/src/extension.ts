import * as vscode from "vscode";
import { Projects } from "./projects.ts";
import { SheetEditorProvider } from "./sheetEditor.ts";

export function activate(context: vscode.ExtensionContext): void {
  const projects = new Projects();
  const sheets = new SheetEditorProvider(context, projects);
  context.subscriptions.push(
    projects,
    sheets.register(),
    vscode.commands.registerCommand("sepia.check", async () => {
      const n = await projects.discover();
      if (!n) void vscode.window.showInformationMessage("sepia: no sepia.json in this workspace");
      else void vscode.commands.executeCommand("workbench.actions.view.problems");
    })
  );
  void projects.discover();
}

export function deactivate(): void {}

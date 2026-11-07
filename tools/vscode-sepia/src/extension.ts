import * as vscode from "vscode";
import { Projects } from "./projects.ts";
import { printToPdf } from "./printCommand.ts";
import { SheetEditorProvider } from "./sheetEditor.ts";
import { View3D } from "./view3d.ts";

export function activate(context: vscode.ExtensionContext): void {
  const projects = new Projects();
  const sheets = new SheetEditorProvider(context, projects);
  const view3d = new View3D(context, projects);
  context.subscriptions.push(
    projects,
    sheets.register(),
    vscode.commands.registerCommand("sepia.print", (root?: string) => printToPdf(projects, typeof root === "string" ? root : undefined)),
    vscode.commands.registerCommand("sepia.view3d", (root?: string, sheet?: string) => view3d.show(typeof root === "string" ? root : undefined, typeof sheet === "string" ? sheet : undefined)),
    vscode.commands.registerCommand("sepia.check", async () => {
      const n = await projects.discover();
      if (!n) void vscode.window.showInformationMessage("sepia: no sepia.json in this workspace");
      else void vscode.commands.executeCommand("workbench.actions.view.problems");
    })
  );
  void projects.discover();
}

export function deactivate(): void {}

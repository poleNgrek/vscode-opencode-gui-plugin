import * as vscode from "vscode";
import { OpenCodePanel } from "./panel";

export function activate(context: vscode.ExtensionContext) {
  const provider = new OpenCodePanel(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("opencode.chatView", provider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // New session command
  context.subscriptions.push(
    vscode.commands.registerCommand("opencode.newSession", () => {
      provider.newSession();
    })
  );

  // Add current file to context
  context.subscriptions.push(
    vscode.commands.registerCommand("opencode.addCurrentFile", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active file to add.");
        return;
      }
      provider.addFileContext(editor.document.uri.fsPath);
    })
  );

  // Focus command
  context.subscriptions.push(
    vscode.commands.registerCommand("opencode.focus", () => {
      vscode.commands.executeCommand("opencode.chatView.focus");
    })
  );
}

export function deactivate() {}

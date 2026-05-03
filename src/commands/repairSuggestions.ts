import * as vscode from 'vscode';
import { runAllChecks } from '../selfHeal/checks';
import { showRepairChecklist } from '../selfHeal/fixApplier';

export function registerRepairSuggestions(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenPilot.repairSuggestions', () => runRepairSuggestions())
  );
}

async function runRepairSuggestions(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    vscode.window.showWarningMessage("Venom's Token Pilot: No workspace folder open.");
    return;
  }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "Venom's Token Pilot: Running checks…" },
    async () => {
      const checks = await runAllChecks(folders[0].uri);
      await showRepairChecklist(checks);
    }
  );
}

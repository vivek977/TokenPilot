import * as vscode from 'vscode';

export function registerAgentModeToggle(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenPilot.agentModeToggle', async () => {
      const pick = await vscode.window.showQuickPick(
        [
          { label: 'Claude Code (default)', description: 'Packet includes @-paths for Claude Code', value: 'claudeCode' },
          { label: 'Human-in-the-Loop', description: 'Packet formatted for claude.ai paste workflow', value: 'hitl' },
        ],
        { placeHolder: 'Select agent mode' }
      );
      if (!pick) { return; }
      await vscode.workspace.getConfiguration('tokenPilot').update(
        'agentMode', pick.value, vscode.ConfigurationTarget.Workspace
      );
      vscode.window.showInformationMessage(`Venom's Token Pilot: Mode set to ${pick.label}.`);
    })
  );
}

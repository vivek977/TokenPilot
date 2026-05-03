import * as vscode from 'vscode';

const MCP_SNIPPET = JSON.stringify(
  {
    "venom-tokenpilot": {
      "type": "stdio",
      "command": "node",
      "args": ["path/to/venom-tokenpilot-mcp-server.js"],
      "description": "Venom's Token Pilot MCP tools: get_plan, get_project_summary, set_plan_step"
    }
  },
  null,
  2
);

export function registerCopyMcpSnippet(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenPilot.copyMcpSnippet', async () => {
      await vscode.env.clipboard.writeText(MCP_SNIPPET);
      vscode.window.showInformationMessage(
        "Venom's Token Pilot: MCP registration snippet copied. Paste into .claude/mcp_servers.json. (MCP server implementation is a future phase.)"
      );
    })
  );
}

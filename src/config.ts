import * as vscode from 'vscode';

const SECTION = 'tokenPilot';

export function getConfig() {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  return {
    autoSetupMode:               cfg.get<'prompt' | 'trustedSilent' | 'off'>('autoSetupMode', 'prompt'),
    autoRefreshOnManifestChange: cfg.get<boolean>('autoRefreshOnManifestChange', true),
    claudeMdMaxLines:            cfg.get<number>('claudeMdMaxLines', 80),
    claudeMdMaxTokens:           cfg.get<number>('claudeMdMaxTokens', 400),
    detectClaudeMdDuplicates:    cfg.get<boolean>('detectClaudeMdDuplicates', false),
    brainMaxLines:               cfg.get<number>('brainMaxLines', 200),
    includeBrainInPacket:        cfg.get<boolean>('includeBrainInPacket', false),
    agentMode:                   cfg.get<'claudeCode' | 'hitl'>('agentMode', 'claudeCode'),
    packetMaxAtPaths:            cfg.get<number>('packetMaxAtPaths', 6),
  };
}

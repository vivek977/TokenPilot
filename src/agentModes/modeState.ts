// Copyright (c) 2026 venom — https://github.com/vivek977/TokenPilot
// Licensed under MIT. Attribution required — do not remove this notice.

import { getConfig } from '../config';

export type AgentMode = 'claudeCode' | 'hitl';

export function getAgentMode(): AgentMode {
  return getConfig().agentMode;
}

export function isHitlMode(): boolean {
  return getAgentMode() === 'hitl';
}

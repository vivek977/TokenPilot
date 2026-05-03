import { getConfig } from '../config';

export type AgentMode = 'claudeCode' | 'hitl';

export function getAgentMode(): AgentMode {
  return getConfig().agentMode;
}

export function isHitlMode(): boolean {
  return getAgentMode() === 'hitl';
}

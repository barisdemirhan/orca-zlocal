import type { AgentType } from '../../../../shared/agent-status/contracts/agent-status-types'

/** The tool an approval prompt is for, read from the hook's `{"approval":{"tool":…}}` envelope. */
export function readApprovalTool(interactivePrompt: string | null): string | null {
  if (!interactivePrompt) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(interactivePrompt)
    if (!parsed || typeof parsed !== 'object' || !('approval' in parsed)) {
      return null
    }
    const approval = parsed.approval
    if (!approval || typeof approval !== 'object' || !('tool' in approval)) {
      return null
    }
    return typeof approval.tool === 'string' && approval.tool ? approval.tool : null
  } catch {
    return null
  }
}

/**
 * Keystroke for the agent's "allow and don't ask again" choice, or null to hide the option.
 * Why null for now: a wrong key here grants a lasting permission, so it ships only after the
 * key is checked against a captured transcript of each agent's approval prompt.
 */
export function agentHubAlwaysAllowKey(_agentType: AgentType): string | null {
  return null
}

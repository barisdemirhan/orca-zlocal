import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { agentHubMirrorTabCapReason } from './agent-hub-mirror-tab-actions'
import type { AgentHubMirrorTabResult } from './agent-hub-mirror-tab-operations'

export function mirrorTabTransferFeedback(
  result: AgentHubMirrorTabResult
): AgentHubMirrorTabResult {
  if (result.status === 'tab-cap') {
    toast.error(agentHubMirrorTabCapReason())
  } else if (result.status !== 'changed' && result.status !== 'noop') {
    toast.error(
      translate('agentHub.mirror.moveUnavailable', 'This terminal is no longer available to move.')
    )
  }
  return result
}

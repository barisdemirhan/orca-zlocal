import { isNonNegativeSafeInteger } from '../../../remote-runtime/ssh/ssh-retained-payload-limits'
import { isBoundedString, MAX_ID_LENGTH } from '../records/agent-session-bounded-string'
import type { AgentSessionDeathEvidence } from './agent-session-death-evidence'

export function isAgentSessionDeathEvidence(value: unknown): value is AgentSessionDeathEvidence {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const evidence = value as Partial<AgentSessionDeathEvidence>
  const { observedAt, lastProvenAliveAt, ownerFence, runtimeEnd } = evidence
  return (
    (evidence.kind === 'exit-observed' ||
      evidence.kind === 'kill-delivered' ||
      evidence.kind === 'pid-absent' ||
      evidence.kind === 'identity-mismatch') &&
    isBoundedString(evidence.detail, MAX_ID_LENGTH) &&
    isNonNegativeSafeInteger(observedAt) &&
    (ownerFence === undefined || isNonNegativeSafeInteger(ownerFence)) &&
    (lastProvenAliveAt === undefined ||
      (isNonNegativeSafeInteger(lastProvenAliveAt) && lastProvenAliveAt <= observedAt)) &&
    (runtimeEnd === undefined || isBoundedString(runtimeEnd, MAX_ID_LENGTH))
  )
}

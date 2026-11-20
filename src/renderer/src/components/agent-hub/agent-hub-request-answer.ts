import { translate } from '@/i18n/i18n'
import { toast } from 'sonner'
import type { AgentHubResponse } from '../../../../shared/agent-hub-requests'
import {
  readAgentHubRequests,
  removeAgentHubResolvedRequest,
  setAgentHubRequestAnswerState,
  type AgentHubRequestAnswerState
} from './agent-hub-requests-store'

type Responder = (host: string, requestId: string, result: AgentHubResponse) => Promise<void>
let responder: Responder | null = null

export function registerAgentHubRequestResponder(next: Responder): () => void {
  responder = next
  return () => {
    if (responder === next) {
      responder = null
    }
  }
}

export async function answerAgentHubRequest(
  host: string,
  requestId: string,
  result: AgentHubResponse
): Promise<void> {
  const current = readAgentHubRequests().get(host)?.answerStates.get(requestId)
  if (current && current.phase !== 'error') {
    return
  }
  const sending: AgentHubRequestAnswerState = { phase: 'sending' }
  if (!setAgentHubRequestAnswerState(host, requestId, sending)) {
    return
  }
  try {
    if (!responder) {
      throw new Error(translate('agentHub.requests.disconnected', 'This host is disconnected.'))
    }
    await responder(host, requestId, result)
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null
    const elsewhere = code === 'already_resolved'
    const missing = code === 'request_not_found'
    // A late failure must not resurrect a card after closure or overwrite a new host's state.
    if (readAgentHubRequests().get(host)?.answerStates.get(requestId) !== sending) {
      if (elsewhere) {
        toast(translate('agentHub.requests.answeredElsewhere', 'Answered elsewhere'), {
          duration: 1500
        })
      }
      return
    }
    const answer: AgentHubRequestAnswerState =
      elsewhere || missing
        ? {
            phase: 'answered-elsewhere',
            ...(missing
              ? {
                  message: translate(
                    'agentHub.requests.unavailable',
                    'This request is no longer available.'
                  )
                }
              : {})
          }
        : {
            phase: 'error',
            message: translate(
              'agentHub.requests.sendFailed',
              'Could not send your answer. Try again.'
            )
          }
    setAgentHubRequestAnswerState(host, requestId, answer)
    if (elsewhere || missing) {
      setTimeout(() => removeAgentHubResolvedRequest(host, requestId, answer), 1500)
    }
  }
}

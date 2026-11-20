import type {
  AgentHubPresence,
  AgentHubRequest,
  AgentHubResponse
} from '../../../shared/agent-hub-requests'

export async function answerAgentHubAskWhenAway(
  request: Extract<AgentHubRequest, { kind: 'ask' }>,
  presence: () => Promise<AgentHubPresence>,
  respond: (answer: AgentHubResponse) => void
): Promise<void> {
  try {
    const { present } = await presence()
    if (!present && request.recommended) {
      respond({
        kind: 'ask',
        answer: request.options[request.recommended - 1],
        index: request.recommended
      })
    }
  } catch {
    // A missing presence reply leaves the question for the human or its deadline.
  }
}

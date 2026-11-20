import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { HubOptionList } from './AgentHubAnswerBody'
import { answerAgentHubRequest } from './agent-hub-request-answer'
import { useAgentHubRequests } from './agent-hub-requests-store'
import { useAgentHubOrbAnswerKeys } from './agent-hub-orb-answer-keys'
import type { AgentHubOrbAttention } from './agent-hub-orb-state'

export function AgentHubOrbRequestAnswer({
  attention,
  onOpen
}: {
  attention: Extract<AgentHubOrbAttention, { kind: 'request' }>
  onOpen: () => void
}): React.JSX.Element {
  const { host, request } = attention.item
  const answer = useAgentHubRequests().get(host)?.answerStates.get(request.requestId)
  const busy = answer !== undefined && answer.phase !== 'error'
  const choose = (index: number): boolean => {
    const option = request.options[index]
    if (busy || !option) {
      return false
    }
    void answerAgentHubRequest(host, request.requestId, {
      kind: 'ask',
      answer: option,
      index: index + 1,
      ...(request.multi ? { indices: [index + 1] } : {})
    })
    return true
  }
  useAgentHubOrbAnswerKeys((key) => {
    if (key === 'Enter') {
      onOpen()
      return true
    }
    return /^[1-9]$/.test(key) && choose(Number(key) - 1)
  })
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 text-left text-sm text-agent-question-text"
      >
        {request.question}
      </button>
      <HubOptionList
        density="chip"
        options={request.options.map((label, index) => ({
          id: String(index),
          label,
          recommended: request.recommended === index + 1
        }))}
        chosen={null}
        disabled={busy}
        onChoose={choose}
      />
      {request.options.length === 0 || request.multi ? (
        <Button type="button" size="xs" variant="ghost" onClick={onOpen}>
          {translate('auto.agentHub.orb.open', 'Open')}
        </Button>
      ) : null}
      {answer?.message ? (
        <span role="status" className="text-xs text-muted-foreground">
          {answer.message}
        </span>
      ) : null}
    </>
  )
}

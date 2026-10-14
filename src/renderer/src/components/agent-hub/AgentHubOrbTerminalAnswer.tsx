import { HubOptionList } from './AgentHubAnswerBody'
import { quickAnswerTargetOf, useAgentHubQuickAnswer } from './use-agent-hub-quick-answer'
import { useAgentHubOrbAnswerKeys } from './agent-hub-orb-answer-keys'
import type { AgentHubOrbAttention } from './agent-hub-orb-state'

export function AgentHubOrbTerminalAnswer({
  attention,
  onOpen
}: {
  attention: Extract<AgentHubOrbAttention, { kind: 'terminal' }>
  onOpen: () => void
}): React.JSX.Element {
  const quick = useAgentHubQuickAnswer(quickAnswerTargetOf(attention.thread))
  useAgentHubOrbAnswerKeys((key) => {
    if (key === 'Enter') {
      if (quick.approval) {
        return quick.chooseByKey(0)
      }
      onOpen()
      return true
    }
    if (key === 'Escape' && quick.approval) {
      return quick.chooseByKey(quick.options.length - 1)
    }
    return /^[1-9]$/.test(key) && quick.chooseByKey(Number(key) - 1)
  })
  return (
    <>
      <button
        type="button"
        className="min-w-0 text-left text-sm text-agent-question-text"
        onClick={onOpen}
      >
        {quick.question}
      </button>
      <HubOptionList
        density="chip"
        options={quick.options}
        chosen={quick.chosen}
        disabled={!quick.canAnswer || quick.chosen !== null}
        onChoose={quick.choose}
      />
    </>
  )
}

import { useEffect, useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import { AGENT_HUB_ORB_MEMORY_MAX_LENGTH } from '../../../../shared/agent-hub-orb-identity'
import { answerAgentHubRequest } from './agent-hub-request-answer'
import {
  agentHubOrbMemoryRequests,
  readAgentHubRequests,
  useAgentHubRequests
} from './agent-hub-requests-store'
import { useAgentHubOrbName } from './use-agent-hub-orb-identity'

export const AGENT_HUB_ORB_MEMORY_CHANGED_EVENT = 'orca:agent-hub-orb-memory-changed'
const OUTCOME_LINGER_MS = 8_000

type Decision = 'remember' | 'decline'

export function AgentHubOrbMemoryCard({
  host,
  sessionId
}: {
  host: string
  sessionId: string
}): React.JSX.Element | null {
  const name = useAgentHubOrbName()
  const state = useAgentHubRequests()
  const proposal = agentHubOrbMemoryRequests(state, { host, sessionId })[0]
  const [outcome, setOutcome] = useState<{ requestId: string; decision: Decision } | null>(null)
  const [editing, setEditing] = useState<{ requestId: string; text: string } | null>(null)
  const answer = proposal ? state.get(host)?.answerStates.get(proposal.requestId) : undefined
  const sending = answer?.phase === 'sending'

  useEffect(() => {
    if (!outcome) {
      return
    }
    const timer = setTimeout(() => setOutcome(null), OUTCOME_LINGER_MS)
    return () => clearTimeout(timer)
  }, [outcome])

  const decide = async (requestId: string, decision: Decision, text: string): Promise<void> => {
    await answerAgentHubRequest(host, requestId, { kind: 'memory', decision, text })
    const phase = readAgentHubRequests().get(host)?.answerStates.get(requestId)?.phase
    if (phase !== undefined && phase !== 'sending') {
      return
    }
    setEditing(null)
    setOutcome({ requestId, decision })
    if (decision === 'remember') {
      window.dispatchEvent(new Event(AGENT_HUB_ORB_MEMORY_CHANGED_EVENT))
    }
  }

  if (!proposal) {
    return outcome ? (
      <p role="status" className="px-3 py-2 text-xs text-muted-foreground">
        {outcome.decision === 'remember'
          ? translate(
              'agentHub.orb.memoryProposal.added',
              'Added to memory · Settings › Orb › Memory'
            )
          : translate('agentHub.orb.memoryProposal.declined', "Won't remember this.")}
      </p>
    ) : null
  }

  const draft = editing?.requestId === proposal.requestId ? editing.text : null
  const text = (draft ?? proposal.text).trim()
  return (
    <section
      aria-label={translate('agentHub.orb.memoryProposal.label', 'Memory suggestion')}
      data-agent-hub-orb-memory-card
      className="m-2 flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-sm"
    >
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lightbulb className="size-3.5 shrink-0" aria-hidden />
        {translate('agentHub.orb.memoryProposal.wants', '{{name}} wants to remember this', {
          name
        })}
      </p>
      {draft === null ? (
        <p className="whitespace-pre-wrap break-words">{proposal.text}</p>
      ) : (
        <Textarea
          autoFocus
          value={draft}
          maxLength={AGENT_HUB_ORB_MEMORY_MAX_LENGTH}
          aria-label={translate('agentHub.orb.memoryProposal.edit', 'Memory text')}
          onChange={(event) =>
            setEditing({ requestId: proposal.requestId, text: event.target.value })
          }
        />
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="xs"
          disabled={sending || text.length === 0}
          onClick={() => void decide(proposal.requestId, 'remember', text)}
        >
          {translate('agentHub.orb.memoryProposal.remember', 'Remember')}
        </Button>
        {draft === null ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={sending}
            onClick={() => setEditing({ requestId: proposal.requestId, text: proposal.text })}
          >
            {translate('agentHub.orb.memoryProposal.editAction', 'Edit')}
          </Button>
        ) : null}
        <Button
          type="button"
          size="xs"
          variant="ghost"
          disabled={sending}
          onClick={() => void decide(proposal.requestId, 'decline', proposal.text)}
        >
          {translate('agentHub.orb.memoryProposal.no', 'No')}
        </Button>
        {answer?.phase === 'error' ? (
          <span role="alert" className="text-xs text-destructive">
            {answer.message}
          </span>
        ) : null}
      </div>
    </section>
  )
}

import { useMemo, type Ref } from 'react'
import { PictureInPicture2, SquareArrowOutUpRight } from 'lucide-react'
import { useAppStore } from '@/store'
import { AgentIcon } from '@/lib/agent-catalog'
import { agentTypeToIconAgent, formatAgentTypeLabel } from '@/lib/agent-status'
import { formatShortTimeAgo } from '@/lib/short-time-ago'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import {
  activityThreadRowCopy,
  threadAgentStateLabel
} from '../activity/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import {
  NativeChatInteractiveCard,
  type NativeChatInteractiveCardControl
} from '../native-chat/NativeChatInteractiveCard'
import { parseInteractivePrompt } from '../native-chat/native-chat-interactive-prompt'
import { useNativeChatInteractiveSend } from '../native-chat/use-native-chat-interactive-send'
import { agentHubStateSince } from './agent-hub-lists'
import { resolveAgentHubPtyId } from './agent-hub-pane-target'

/**
 * An agent waiting on the user: its question or approval as the native chat card, sent to
 * the agent's terminal with the same keystrokes the chat surface uses (SSH included).
 */
export function AgentHubAttentionCard({
  thread,
  location,
  now,
  controlRef,
  onJump,
  onPopout
}: {
  thread: AgentPaneThread
  location: string
  now: number
  controlRef: Ref<NativeChatInteractiveCardControl>
  onJump: () => void
  onPopout: () => void
}): React.JSX.Element {
  const { paneKey } = thread
  const interactivePrompt = useAppStore(
    (s) => s.agentStatusByPaneKey[paneKey]?.interactivePrompt ?? null
  )
  const toolName = useAppStore((s) => {
    const entry = s.agentStatusByPaneKey[paneKey]
    return entry?.interactivePrompt ? (entry.toolName ?? null) : null
  })
  const card = useMemo(
    () => parseInteractivePrompt(interactivePrompt, toolName ?? undefined),
    [interactivePrompt, toolName]
  )
  const ptyId = useAppStore((s) => resolveAgentHubPtyId(s, thread.tab.id, paneKey))
  const send = useNativeChatInteractiveSend(thread.tab.id, paneKey, ptyId, thread.agentType)
  const copy = activityThreadRowCopy(thread)
  const agent = agentTypeToIconAgent(thread.agentType)
  const canAnswer = card !== null && ptyId !== null
  const waitingText =
    card?.kind === 'question'
      ? (card.prompt.questions[0]?.question ?? copy.statusLine)
      : card?.kind === 'approval'
        ? [card.approval.title, card.approval.detail].filter(Boolean).join(' ')
        : copy.statusLine

  return (
    <section
      className="space-y-2.5"
      aria-label={copy.taskTitle}
      data-agent-hub-attention-card={paneKey}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex shrink-0">
          <AgentIcon agent={agent} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{copy.taskTitle}</div>
          <div className="truncate text-xs text-muted-foreground">
            {formatAgentTypeLabel(thread.agentType)} · {threadAgentStateLabel(thread)} ·{' '}
            {formatShortTimeAgo(agentHubStateSince(thread), now)} · {location}
          </div>
        </div>
      </div>
      {canAnswer ? (
        <NativeChatInteractiveCard
          card={card}
          send={send}
          canSend
          layout="embedded"
          highlightRecommended
          controlRef={controlRef}
        />
      ) : (
        // Why: the structured prompt can be absent (older hook, relay trimmed it, no live PTY);
        // the agent is still waiting, so say what it said and point at its terminal.
        <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm">
          {waitingText ? <p className="line-clamp-4 break-words">{waitingText}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {translate(
              'agentHub.attention.answerInTerminal',
              'Answer this one in its terminal: pop it out or open it in Orca.'
            )}
          </p>
        </div>
      )}
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="xs" tabIndex={-1} onClick={onJump}>
          <SquareArrowOutUpRight className="size-3" />
          {translate('agentHub.row.jump', 'Open in Orca')}
        </Button>
        <Button type="button" variant="ghost" size="xs" tabIndex={-1} onClick={onPopout}>
          <PictureInPicture2 className="size-3" />
          {translate('agentHub.row.popOut', 'Pop out')}
        </Button>
      </div>
    </section>
  )
}

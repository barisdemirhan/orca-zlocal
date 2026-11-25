import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { AgentHubOrbThinking } from './AgentHubOrbSpeechBubble'
import { AgentHubOrbBotBubbleActions, orbBotBubbleText } from './AgentHubOrbBotBubble'
import type { AgentHubOrbBotBubbleView } from './use-agent-hub-orb-bot-bubble'
import type { AgentHubOrbQuickAsk } from './use-agent-hub-orb-quick-write'
import type { AgentHubOrbState } from './agent-hub-orb-state'

/** A written reply stays under the sphere this long; spoken captions keep their minute. */
export const AGENT_HUB_ORB_REPLY_MS = 12_000

export type AgentHubOrbCaptionSlots = {
  caption?: string
  captionKey?: string
  captionDurationMs?: number
  captionPrompt?: string
  captionStatus?: ReactNode
  captionAction?: ReactNode
  captionHint?: ReactNode
}

/** What the sphere's speech bubble shows: live captions, a bot bubble, or the written reply. */
export function agentHubOrbCaptionSlots(args: {
  live: boolean
  liveCaption: string | undefined
  bubble: AgentHubOrbBotBubbleView | null
  hasAsks: boolean
  onAnswer: (key?: string) => void
  onDismiss: (key: string) => void
  reply: string | null
  replyKey: string | undefined
  ask: AgentHubOrbQuickAsk | null | undefined
  state: AgentHubOrbState
  memoryPending: boolean
  onShowChat: () => void
  onOpenConversation: () => void
}): AgentHubOrbCaptionSlots {
  const { live, bubble, ask, reply } = args
  if (live) {
    return {
      caption: args.liveCaption,
      captionHint: undefined
    }
  }
  const hint = args.memoryPending ? (
    <p className={reply ? 'mt-2 text-xs text-muted-foreground' : 'text-xs text-muted-foreground'}>
      {translate('agentHub.orb.memoryProposal.hint', 'Memory suggestion')}
      {' · '}
      <button
        type="button"
        className="cursor-pointer underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        onClick={args.onOpenConversation}
      >
        {translate('agentHub.orb.memoryProposal.openConversation', 'Open conversation')}
      </button>
    </p>
  ) : undefined
  if (bubble) {
    return {
      caption: orbBotBubbleText(bubble),
      captionKey: bubble.bubble.key,
      captionDurationMs: AGENT_HUB_ORB_REPLY_MS,
      captionStatus: (
        <AgentHubOrbBotBubbleActions
          view={bubble}
          hasAsks={args.hasAsks}
          onAnswer={args.onAnswer}
          onDismiss={args.onDismiss}
        />
      ),
      captionHint: hint
    }
  }
  let status: ReactNode
  if (ask && ask.status !== 'answered') {
    status =
      ask.status === 'failed' ? (
        <p className="text-muted-foreground">
          {translate('agentHub.orb.captionNoReply', 'No reply came back.')}
        </p>
      ) : (
        <AgentHubOrbThinking
          command={args.state.kind === 'working' ? args.state.command : undefined}
        />
      )
  }
  return {
    caption: reply ?? undefined,
    captionKey: args.replyKey,
    captionDurationMs: AGENT_HUB_ORB_REPLY_MS,
    captionPrompt: ask?.text,
    captionStatus: status,
    captionAction:
      !reply && !ask ? undefined : (
        <Button
          type="button"
          variant="link"
          size="xs"
          className="ml-auto shrink-0"
          onClick={args.onShowChat}
        >
          {translate('agentHub.orb.openChat', 'Open chat')}
          <ChevronRight aria-hidden />
        </Button>
      ),
    captionHint: hint
  }
}

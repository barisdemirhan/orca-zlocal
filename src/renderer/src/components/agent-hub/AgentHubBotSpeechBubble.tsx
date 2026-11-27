import { AlertTriangle, Check, HelpCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/class-names'
import { BotAvatar } from '../bots/BotAvatar'
import { formatWorkspaceCleanupRelativeTime } from '../workspace-cleanup/candidate-list/workspace-cleanup-relative-time'
import type { Bot } from '../../../../shared/bot-types'

export type AgentHubBotBubbleTone = 'ask' | 'result' | 'failure'

const MARKS = {
  ask: { Glyph: HelpCircle, className: 'bg-agent-question text-white' },
  result: { Glyph: Check, className: 'bg-status-success text-white' },
  failure: { Glyph: AlertTriangle, className: 'bg-destructive text-white' }
} as const

const EDGE: Record<AgentHubBotBubbleTone, string> = {
  ask: 'border-agent-question/45',
  result: 'border-foreground/[0.12]',
  failure: 'border-destructive/45'
}

const TAIL_EDGE: Record<AgentHubBotBubbleTone, string> = {
  ask: 'border-agent-question/45',
  result: 'border-foreground/[0.12]',
  failure: 'border-destructive/45'
}

export function AgentHubBotFace({
  bot,
  tone
}: {
  bot: Bot
  tone: AgentHubBotBubbleTone
}): React.JSX.Element {
  const { Glyph, className } = MARKS[tone]
  return (
    <span className="relative mb-1 size-10 shrink-0">
      <BotAvatar bot={bot} className="size-10 rounded-full text-sm" />
      <span
        aria-hidden
        className={cn(
          'absolute -right-0.5 -bottom-0.5 grid size-4 place-items-center rounded-full ring-2 ring-popover',
          className
        )}
      >
        <Glyph className="size-2.5" />
      </span>
    </span>
  )
}

/** A bot's news as a speech bubble: its face outside on the left, the bubble's tail pointing back at it. */
export function AgentHubBotSpeechBubble({
  bot,
  tone,
  headline,
  from,
  hostLabel,
  at,
  offline = false,
  reduceMotion = false,
  alertKey,
  onDismiss,
  children
}: {
  bot: Bot
  tone: AgentHubBotBubbleTone
  /** "asks you", "finished", "could not finish", "3 updates". */
  headline: string
  /** Where it came from, as "Home chat · #7". */
  from: string | null
  /** Set only when the owner has bots on several computers. */
  hostLabel: string | null
  at: number
  offline?: boolean
  reduceMotion?: boolean
  alertKey: string
  onDismiss: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      role="status"
      data-agent-hub-alert={tone === 'ask' ? 'ask' : 'done'}
      data-agent-hub-bot-alert={alertKey}
      data-agent-hub-bot-bubble={tone}
      data-offline={offline || undefined}
      className={cn(
        'flex w-96 max-w-full shrink-0 items-end gap-2.5 duration-200',
        !reduceMotion && 'animate-in fade-in-0 slide-in-from-left-2',
        offline && 'opacity-60'
      )}
    >
      <AgentHubBotFace bot={bot} tone={tone} />
      <div className="relative min-w-0 flex-1">
        <span
          aria-hidden
          className={cn(
            'absolute bottom-3 -left-1.5 size-3 rotate-45 border-b border-l bg-popover',
            TAIL_EDGE[tone]
          )}
        />
        <div
          className={cn(
            'relative flex flex-col gap-2 rounded-2xl rounded-bl-md border bg-popover px-3.5 pt-2.5 pb-3 text-popover-foreground shadow-floating',
            EDGE[tone]
          )}
        >
          <div className="flex items-center gap-1.5 pr-6 text-[12px] leading-tight">
            <span className="min-w-0 truncate">
              <span className="font-semibold text-foreground">{bot.name}</span>
              <span
                data-tone={tone}
                className="text-agent-question-text data-[tone=failure]:text-destructive data-[tone=result]:text-muted-foreground"
              >
                {' · '}
                {headline}
              </span>
              {from ? <span className="text-muted-foreground">{` · ${from}`}</span> : null}
            </span>
            {hostLabel ? (
              <span className="shrink-0 rounded-full bg-foreground/[0.07] px-1.5 py-px text-[10px] text-muted-foreground">
                {hostLabel}
              </span>
            ) : null}
            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
              {formatWorkspaceCleanupRelativeTime(at)}
            </span>
          </div>
          {children}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={translate('agentHub.alert.dismiss', 'Dismiss')}
            onClick={onDismiss}
            className="absolute top-1.5 right-1.5"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

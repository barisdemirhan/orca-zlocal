import { Bot as BotIcon, SquareTerminal } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { pressAgentHubSide, type AgentHubInboxSideChoice } from './agent-hub-panel-list-state'

function SideBadge({
  side,
  count,
  pressed,
  onPress
}: {
  side: 'bots' | 'agents'
  count: number
  pressed: boolean
  onPress: () => void
}): React.JSX.Element {
  const label =
    side === 'bots'
      ? translate('agentHub.inbox.side.bots', 'Bots')
      : translate('agentHub.inbox.side.agents', 'Agents')
  const Icon = side === 'bots' ? BotIcon : SquareTerminal
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-pressed={pressed}
      aria-label={label}
      title={translate('agentHub.inbox.side.keyHint', '{{label}} (B)', { label })}
      data-agent-hub-side={side}
      data-zero={count === 0}
      onClick={onPress}
      className="flex h-6 items-center gap-1 rounded-md px-1.5 text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground aria-pressed:bg-foreground/[0.1] aria-pressed:text-foreground data-[zero=true]:opacity-40"
    >
      <Icon aria-hidden className="size-3.5" />
      <span className="min-w-2 text-center font-mono text-[11px] tabular-nums">{count}</span>
    </button>
  )
}

/** Two badges with their own waiting counts; their positions never move, a zero only dims. */
export function AgentHubInboxSideSwitch({
  choice,
  botsActive,
  botAsks,
  agentAsks,
  onChoice
}: {
  choice: AgentHubInboxSideChoice
  botsActive: boolean
  botAsks: number
  agentAsks: number
  onChoice: (choice: AgentHubInboxSideChoice) => void
}): React.JSX.Element | null {
  if (!botsActive) {
    return null
  }
  return (
    <div className="flex items-center gap-0.5" role="group">
      <SideBadge
        side="bots"
        count={botAsks}
        pressed={choice === 'bots'}
        onPress={() => onChoice(pressAgentHubSide(choice, 'bots'))}
      />
      <SideBadge
        side="agents"
        count={agentAsks}
        pressed={choice === 'agents'}
        onPress={() => onChoice(pressAgentHubSide(choice, 'agents'))}
      />
    </div>
  )
}

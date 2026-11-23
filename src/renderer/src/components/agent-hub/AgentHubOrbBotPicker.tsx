import { botRefKey } from '@/lib/bot-hosts'
import { cn } from '@/lib/class-names'
import { translate } from '@/i18n/i18n'
import { BotRowLineView } from '../bots/BotRowActivityLine'
import { useBotRowDetails } from '../bots/BotHoverDetails'
import type { Bot } from '../../../../shared/bot-types'
import type { FolderWorkspace } from '../../../../shared/folder-workspaces/folder-workspace-types'
import { AgentHubBotFace, AgentHubBotHostChip } from './AgentHubBotsRow'
import type { AgentHubOrbBotMention } from './use-agent-hub-orb-bot-mention'

/** One bot as `@` lists it: its face with the live badge, its computer when not this one, and what
 *  it is doing now, as the Bots tab row says it. */
function PickerRow({
  bot,
  home,
  selected,
  onHover,
  onPick
}: {
  bot: Bot
  home: FolderWorkspace
  selected: boolean
  onHover: () => void
  onPick: () => void
}): React.JSX.Element {
  const details = useBotRowDetails(bot, home)
  const { hostLabel, offline, line, limit, description, now } = details
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm',
        selected && 'bg-accent text-accent-foreground',
        (bot.paused || offline) && 'opacity-60'
      )}
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={onHover}
      onClick={onPick}
    >
      <AgentHubBotFace bot={bot} details={details} className="size-5 rounded text-[10px]" />
      <span className="shrink-0 font-medium">{bot.name}</span>
      {hostLabel ? <AgentHubBotHostChip label={hostLabel} /> : null}
      {bot.paused ? (
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {translate('auto.agentHub.orb.botPaused', 'Paused · holds the message')}
        </span>
      ) : (
        <span className="min-w-0 flex-1">
          <BotRowLineView
            line={line}
            limit={offline ? null : limit}
            fallback={description}
            unread={false}
            now={now}
            disconnected={offline}
          />
        </span>
      )}
    </button>
  )
}

/** The bots `@` lists under the Orb's quick box; the box keeps focus, so rows take no focus on press. */
export function AgentHubOrbBotPicker({
  mention
}: {
  mention: Pick<AgentHubOrbBotMention, 'options' | 'active' | 'pick' | 'setActive'>
}): React.JSX.Element {
  return (
    <div
      role="listbox"
      className="agent-hub-orb-bot-picker absolute inset-x-0 top-full z-50 mt-1 max-h-48 overflow-y-auto scrollbar-sleek rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-floating"
    >
      {mention.options.map(({ bot, home }, index) => (
        <PickerRow
          key={botRefKey(bot)}
          bot={bot}
          home={home}
          selected={index === mention.active}
          onHover={() => mention.setActive(index)}
          onPick={() => mention.pick(bot)}
        />
      ))}
    </div>
  )
}

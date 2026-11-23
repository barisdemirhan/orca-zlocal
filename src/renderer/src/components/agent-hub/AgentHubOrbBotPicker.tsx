import { botRefKey } from '@/lib/bot-hosts'
import { BotAvatar } from '../bots/BotAvatar'
import { cn } from '@/lib/class-names'
import { translate } from '@/i18n/i18n'
import type { AgentHubOrbBotMention } from './use-agent-hub-orb-bot-mention'

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
      {mention.options.map(({ bot, purpose }, index) => (
        <button
          key={botRefKey(bot)}
          type="button"
          role="option"
          aria-selected={index === mention.active}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm',
            index === mention.active && 'bg-accent text-accent-foreground'
          )}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => mention.setActive(index)}
          onClick={() => mention.pick(bot)}
        >
          <BotAvatar bot={bot} className="size-5 shrink-0" />
          <span className="shrink-0 font-medium">{bot.name}</span>
          {bot.paused ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {translate('auto.agentHub.orb.botPaused', 'Paused · holds the message')}
            </span>
          ) : purpose ? (
            <span className="min-w-0 truncate text-xs text-muted-foreground">{purpose}</span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

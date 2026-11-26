import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { getTerminalQuickCommandHostOptions } from '@/lib/terminal/quick-commands/use-terminal-quick-command-hosts'
import { BotAvatar, CarriedBotAvatar } from '../bots/BotAvatar'
import type { Bot } from '../../../../shared/bot-types'
import { NativeChatMarkdown } from '../native-chat/markdown/NativeChatMarkdown'
import { NativeChatCodeBlock } from '../native-chat/markdown/code/NativeChatCodeBlock'
import { NativeChatMessageTimestamp } from '../native-chat/messages/rows/NativeChatMessageTimestamp'
import { openBotPage } from './agent-hub-bot-page-open'

/** Another bot's message in the Orb chat: its face outside, then a bubble with name, subject, host and time. */
export function AgentHubOrbBotMessage({
  messageId,
  name,
  bot,
  carried,
  subject,
  host,
  timestamp,
  text
}: {
  messageId: string
  name: string
  bot: Bot | null
  carried: { avatar: string | null } | null
  subject: string | null
  host: string | null
  timestamp: number | null
  text: string
}): React.JSX.Element {
  const [thread, setThread] = useState(false)
  const hostCount = useAppStore(
    (s) => getTerminalQuickCommandHostOptions(s.settings, s.runtimeEnvironments).length
  )
  const lines = text.split('\n')
  const folded = !thread && (lines.length > 3 || text.length > 280)
  return (
    <div data-agent-hub-orb-bot-message className="flex w-full items-end gap-2 px-3 py-1">
      {bot ? (
        <BotAvatar bot={bot} className="size-7 shrink-0 rounded-full" />
      ) : (
        <CarriedBotAvatar
          name={name}
          avatar={carried?.avatar ?? null}
          className="size-7 shrink-0 rounded-full"
        />
      )}
      <div className="min-w-0 flex-1 rounded-2xl rounded-bl-md border border-border bg-foreground/[0.025] px-3 py-2 text-[13px]">
        <p className="mb-0.5 flex min-w-0 items-center gap-1.5 text-xs">
          <b className="shrink-0">{name}</b>
          {subject ? (
            <span className="min-w-0 truncate text-muted-foreground">
              {translate('agentHub.orb.bot.replyTo', 'Re: {{subject}}', { subject })}
            </span>
          ) : null}
          {hostCount > 1 && host ? (
            <span className="shrink-0 rounded bg-foreground/[0.06] px-1.5 text-2xs text-muted-foreground">
              {host}
            </span>
          ) : null}
          <span className="ml-auto shrink-0 text-muted-foreground">
            <NativeChatMessageTimestamp timestamp={timestamp} />
          </span>
        </p>
        <div className={folded ? 'line-clamp-3' : undefined}>
          <NativeChatMarkdown
            rowKey={messageId}
            content={text}
            variant="document"
            className="text-[13px]"
            renderCodeBlock={NativeChatCodeBlock}
          />
        </div>
        <div className="mt-1.5 flex gap-3">
          {bot ? (
            <Button
              type="button"
              variant="link-muted"
              size="inlineInherit"
              className="text-xs"
              onClick={() => void openBotPage(bot)}
            >
              {translate('agentHub.orb.botMessage.open', 'Open {{name}}', { name })}
            </Button>
          ) : null}
          {folded || thread ? (
            <Button
              type="button"
              variant="link-muted"
              size="inlineInherit"
              className="text-xs"
              onClick={() => setThread(!thread)}
            >
              {thread
                ? translate('agentHub.orb.botMessage.hideThread', 'Hide thread')
                : translate('agentHub.orb.botMessage.showThread', 'Show thread')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

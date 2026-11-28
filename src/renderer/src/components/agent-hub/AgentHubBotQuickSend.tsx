import { useState } from 'react'
import { translate } from '@/i18n/i18n'
import { botErrorMessage } from '../bots/bot-presentation'
import type { Bot } from '../../../../shared/bot-types'
import { sendToBotHomeChat } from './agent-hub-bot-quick-send'

type SendState = 'idle' | 'sending' | 'sent' | 'failed'

/** "Ask <bot>…" at the foot of a bot's page: Enter sends to its Home Chat, Shift+Enter breaks the line. */
export function AgentHubBotQuickSend({ bot }: { bot: Bot }): React.JSX.Element {
  const [text, setText] = useState('')
  const [state, setState] = useState<SendState>('idle')
  const [error, setError] = useState<string | null>(null)
  const send = (): void => {
    const body = text.trim()
    if (!body || state === 'sending') {
      return
    }
    setState('sending')
    setError(null)
    sendToBotHomeChat(bot, body)
      .then((delivered) => {
        if (delivered) {
          setText('')
        }
        setState(delivered ? 'sent' : 'failed')
      })
      .catch((cause: unknown) => {
        setError(botErrorMessage(cause))
        setState('failed')
      })
  }
  const status =
    state === 'sent'
      ? translate('agentHub.bots.page.sent', 'Sent')
      : state === 'failed'
        ? (error ?? translate('agentHub.bots.page.sendFailed', 'Couldn’t send'))
        : null
  return (
    <form
      data-agent-hub-bot-quick-send
      onSubmit={(event) => {
        event.preventDefault()
        send()
      }}
      className="flex flex-col gap-1 border-t border-border/60 bg-popover px-2.5 py-2"
    >
      <textarea
        value={text}
        rows={2}
        aria-label={translate('agentHub.bots.page.askLabel', 'Message {{name}}', {
          name: bot.name
        })}
        placeholder={translate('agentHub.bots.page.ask', 'Ask {{name}}…', { name: bot.name })}
        onChange={(event) => {
          setText(event.target.value)
          if (state !== 'sending') {
            setState('idle')
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            send()
          }
          if (event.key !== 'Escape') {
            event.stopPropagation()
          }
        }}
        className="max-h-28 min-h-9 w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
      />
      <span
        role="status"
        data-state={state}
        className="min-h-4 text-[11px] leading-4 text-muted-foreground"
      >
        {status}
      </span>
    </form>
  )
}

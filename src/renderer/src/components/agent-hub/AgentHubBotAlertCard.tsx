import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { openBotHomeTab } from '@/lib/bot-catalog'
import { HubOptionList } from './AgentHubAnswerBody'
import { AgentHubBotAvatar } from './AgentHubBotMark'
import { AGENT_HUB_ANSWERED_VISIBLE_MS } from './use-agent-hub-quick-answer'
import { agentHubBotAskLine, useAgentHubBotAsk } from './use-agent-hub-bot-ask'
import type { AgentHubBotAlert } from './agent-hub-alerts'

const ALERT_VISIBLE_MS = 7000
const QUICK_OPTION_LIMIT = 4

/** A bot's new ask as a bubble: who, its number and question, and chips to answer in place. */
export function AgentHubBotAlertCard({
  alert,
  onDismiss
}: {
  alert: AgentHubBotAlert
  onDismiss: (id: string) => void
}): React.JSX.Element {
  const { bot, item } = alert.bot
  const { options, chosen, choose } = useAgentHubBotAsk(bot, item)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dismissRef = useRef(() => onDismiss(alert.id))
  dismissRef.current = () => onDismiss(alert.id)
  const stopTimer = (): void => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }
  const startTimer = (ms = ALERT_VISIBLE_MS): void => {
    stopTimer()
    timerRef.current = setTimeout(() => dismissRef.current(), ms)
  }
  // A new alert restarts the countdown; re-renders must not.
  useEffect(() => {
    const timer = setTimeout(() => dismissRef.current(), ALERT_VISIBLE_MS)
    timerRef.current = timer
    return () => clearTimeout(timer)
  }, [alert.id])
  return (
    <div
      role="status"
      data-agent-hub-alert="ask"
      data-agent-hub-bot-alert={alert.bot.botKey}
      className="w-80 shrink-0 animate-in rounded-xl border border-foreground/[0.12] bg-popover text-popover-foreground shadow-floating duration-200 fade-in-0 zoom-in-95"
      onMouseEnter={stopTimer}
      onMouseLeave={() => startTimer()}
    >
      <div className="relative px-3 py-2.5">
        <button
          type="button"
          className="block w-full text-left"
          onClick={() => {
            void openBotHomeTab(bot)
            onDismiss(alert.id)
          }}
        >
          <span className="flex items-center gap-2.5 pr-8">
            <AgentHubBotAvatar identity={{ bot, origin: 'home' }} />
            <span className="min-w-0 flex-1 truncate text-[13px]">
              <span className="font-semibold">
                {translate('agentHub.bots.alertAsking', '{{name}} is asking', { name: bot.name })}
              </span>{' '}
              <span className="font-mono text-[11px] text-agent-question-text">#{item.number}</span>
            </span>
          </span>
          <span className="mt-1.5 line-clamp-3 text-[13px] break-words text-foreground/85">
            {agentHubBotAskLine(item)}
          </span>
        </button>
        {options.length > 0 ? (
          <div className="mt-2">
            <HubOptionList
              options={options.slice(0, QUICK_OPTION_LIMIT)}
              chosen={chosen}
              disabled={chosen !== null}
              density="chip"
              onChoose={(index) =>
                choose(index, () => {
                  stopTimer()
                  startTimer(AGENT_HUB_ANSWERED_VISIBLE_MS)
                })
              }
            />
          </div>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={translate('agentHub.alert.dismiss', 'Dismiss')}
          onClick={() => onDismiss(alert.id)}
          className="absolute top-2 right-2"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

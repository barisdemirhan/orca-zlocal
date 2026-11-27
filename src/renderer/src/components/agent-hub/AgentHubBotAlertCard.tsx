import { useCallback, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useBotHostOffline } from '@/lib/bot-host-views'
import { readBotHostIds, subscribeToBotChanges } from '@/lib/bot-catalog-snapshot'
import { useBotHostLabel } from '../bots/use-bot-host-label'
import {
  AgentHubBotAccessBody,
  AgentHubBotAskBody,
  AgentHubBotRequestBody,
  AgentHubBotRunsBody,
  AgentHubBotSignInBody,
  AgentHubBotSuggestionBody,
  AgentHubBotThreadBody,
  botAlertFrom
} from './AgentHubBotBubbleBodies'
import { AgentHubBotSpeechBubble, type AgentHubBotBubbleTone } from './AgentHubBotSpeechBubble'
import { parkAgentHubBot } from './agent-hub-bot-parked-store'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'
import type {
  AgentHubBotAlert,
  AgentHubRequestAlert,
  AgentHubThreadAlert
} from './agent-hub-alerts'
import {
  BOT_ANSWERED_VISIBLE_MS,
  BOT_FAILURE_VISIBLE_MS,
  BOT_RESULT_VISIBLE_MS,
  useAgentHubBotBubbleLifetime
} from './use-agent-hub-bot-bubble-lifetime'

function toneOf(alert: AgentHubBotAlert): AgentHubBotBubbleTone {
  return alert.kind === 'ask' ? 'ask' : alert.kind === 'failure' ? 'failure' : 'result'
}

function headlineOf(tone: AgentHubBotBubbleTone, updates: number): string {
  if (updates > 1) {
    return translate('agentHub.botBubble.updates', '{{value0}} updates', { value0: updates })
  }
  switch (tone) {
    case 'ask':
      return translate('agentHub.botBubble.asksYou', 'asks you')
    case 'failure':
      return translate('agentHub.botBubble.couldNotFinish', 'could not finish')
    case 'result':
      return translate('agentHub.botBubble.finished', 'finished')
  }
}

function BubbleBody({
  lead,
  close,
  later,
  settle,
  answerKeys,
  onOpenAlert,
  presentationOf,
  onOpenInbox
}: {
  lead: AgentHubBotAlert
  close: () => void
  later: () => void
  settle: () => void
  answerKeys: boolean
  onOpenAlert: (alert: AgentHubThreadAlert | AgentHubRequestAlert) => void
  presentationOf: (alert: AgentHubRequestAlert) => AgentHubRequestPresentation
  onOpenInbox?: () => void
}): React.JSX.Element {
  const { bot, subject } = lead.bot
  switch (subject.type) {
    case 'item':
      return <AgentHubBotAskBody bot={bot} subject={subject} onLater={later} onSettled={settle} />
    case 'signin':
      return <AgentHubBotSignInBody bot={bot} subject={subject} onLater={later} />
    case 'access':
      return <AgentHubBotAccessBody subject={subject} onLater={later} />
    case 'runs':
      return <AgentHubBotRunsBody bot={bot} subject={subject} />
    case 'thread':
      return (
        <AgentHubBotThreadBody
          subject={subject}
          failed={lead.kind === 'failure'}
          answerKeys={answerKeys}
          onOpen={() => {
            onOpenAlert(subject.alert)
            close()
          }}
          onSettled={settle}
        />
      )
    case 'request':
      return (
        <AgentHubBotRequestBody
          subject={subject}
          presentation={presentationOf(subject.alert)}
          onOpen={() => onOpenAlert(subject.alert)}
          onDismiss={later}
        />
      )
    case 'suggestion':
      return (
        <AgentHubBotSuggestionBody
          bot={bot}
          subject={subject}
          onClose={close}
          onOpenInbox={onOpenInbox}
        />
      )
  }
}

/**
 * One bubble per bot: its most urgent news with the body to act on, and "N updates" when more waits.
 * Later or the cross only hides the bubble; whatever it asked keeps counting in the Inbox.
 */
export function AgentHubBotAlertCard({
  lead,
  updates,
  ids,
  onDismiss,
  onOpenInbox,
  reduceMotion,
  answerKeys,
  onOpenAlert,
  presentationOf,
  held,
  arrival
}: {
  lead: AgentHubBotAlert
  updates: number
  ids: readonly string[]
  onDismiss: (id: string) => void
  onOpenInbox?: () => void
  reduceMotion: boolean
  /** The front bubble answers to 1-9 and opens with the Enter key. */
  answerKeys: boolean
  onOpenAlert: (alert: AgentHubThreadAlert | AgentHubRequestAlert) => void
  presentationOf: (alert: AgentHubRequestAlert) => AgentHubRequestPresentation
  /** Hover or focus anywhere on the stack pauses the countdown. */
  held: boolean
  /** The newest alert's time in the stack: a new arrival restarts the countdown. */
  arrival: number
}): React.JSX.Element {
  const { bot, botKey, at } = lead.bot
  const tone = toneOf(lead)
  const offline = useBotHostOffline(bot.hostId)
  const hostIds = useSyncExternalStore(subscribeToBotChanges, readBotHostIds, readBotHostIds)
  // Why 2+: with one computer the label says nothing.
  const hostLabel = useBotHostLabel(bot.hostId)
  const shownHostLabel = hostIds.length >= 2 ? hostLabel : null
  const [settledId, setSettledId] = useState<string | null>(null)
  const settled = settledId === lead.id
  const close = useCallback(() => ids.forEach(onDismiss), [ids, onDismiss])
  const park = useCallback(() => {
    parkAgentHubBot(botKey)
    ids.forEach(onDismiss)
  }, [botKey, ids, onDismiss])
  const ms = settled
    ? BOT_ANSWERED_VISIBLE_MS
    : tone === 'ask'
      ? null
      : tone === 'failure'
        ? BOT_FAILURE_VISIBLE_MS
        : BOT_RESULT_VISIBLE_MS
  useAgentHubBotBubbleLifetime(`${lead.id}:${arrival}`, ms, held && !settled, close)
  const settle = useCallback(() => setSettledId(lead.id), [lead.id])
  return (
    <AgentHubBotSpeechBubble
      bot={bot}
      tone={tone}
      headline={headlineOf(tone, updates)}
      from={updates > 1 ? null : botAlertFrom(lead)}
      hostLabel={shownHostLabel}
      at={at}
      offline={offline}
      reduceMotion={reduceMotion}
      alertKey={botKey}
      onDismiss={close}
    >
      <fieldset disabled={offline} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <BubbleBody
          lead={lead}
          close={close}
          later={park}
          settle={settle}
          answerKeys={answerKeys}
          onOpenAlert={onOpenAlert}
          presentationOf={presentationOf}
          onOpenInbox={onOpenInbox}
        />
        {updates > 1 && onOpenInbox ? (
          <Button size="xs" variant="outline" className="self-start" onClick={onOpenInbox}>
            {translate('agentHub.botBubble.openInbox', 'Open in Inbox')}
          </Button>
        ) : null}
      </fieldset>
    </AgentHubBotSpeechBubble>
  )
}

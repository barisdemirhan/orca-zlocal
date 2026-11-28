import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { openBotHomeTab } from '@/lib/bot-catalog'
import { formatWorkspaceCleanupRelativeTime } from '../workspace-cleanup/candidate-list/workspace-cleanup-relative-time'
import { openBotSession } from '../bots/bot-session-open'
import { dismissSuggestion, startSuggestion } from '../bots/bot-up-next-actions'
import { openBotItemInHome } from '../bots/items/bot-item-open'
import { AgentHubBotAskBlock } from './AgentHubBotAskBlock'
import type { OrbAskEntry } from './agent-hub-orb-ask-entries'
import type { AgentHubOrbBotBubbleView } from './use-agent-hub-orb-bot-bubble'

/** The bubble's sentence; the brief and "<Bot> asks" are already written by the hook. */
export function orbBotBubbleText(view: AgentHubOrbBotBubbleView): string {
  const { bubble } = view
  switch (bubble.kind) {
    case 'failure':
      return translate('agentHub.orb.bot.failed', '{{name}} failed', { name: bubble.event.name })
    case 'result':
      return translate('agentHub.orb.bot.finished', '{{name}} finished · {{when}}', {
        name: bubble.event.name,
        when: formatWorkspaceCleanupRelativeTime(bubble.event.at)
      })
    case 'other':
      return translate('agentHub.orb.bot.asks', '{{name}} asks', { name: view.text })
    case 'suggestion':
      return bubble.text
    case 'brief':
      return view.text
  }
}

/** The action row under a bubble's text; it pins the bubble until the owner picks one. */
export function AgentHubOrbBotBubbleActions({
  view,
  hasAsks,
  onAnswer,
  onDismiss
}: {
  view: AgentHubOrbBotBubbleView
  hasAsks: boolean
  onAnswer: (key?: string) => void
  onDismiss: (key: string) => void
}): React.JSX.Element {
  const { bubble, bot } = view
  const dismiss = (): void => onDismiss(bubble.key)
  const chatSession =
    bubble.kind === 'failure' || bubble.kind === 'result' ? bubble.event.sessionId : null
  return (
    <div className="mt-2 flex items-center justify-end gap-1">
      {bubble.kind === 'failure' || bubble.kind === 'result' ? (
        <>
          {chatSession && bot ? (
            <Button
              type="button"
              size="xs"
              variant="link"
              onClick={() => {
                openBotSession(bot, chatSession)
                dismiss()
              }}
            >
              {translate('agentHub.orb.openChat', 'Open chat')}
            </Button>
          ) : null}
          <Button type="button" size="xs" variant="ghost" onClick={dismiss}>
            {translate('agentHub.orb.bot.dismiss', 'Dismiss')}
          </Button>
        </>
      ) : null}
      {bubble.kind === 'brief' ? (
        <>
          {hasAsks ? (
            <Button
              type="button"
              size="xs"
              variant="link"
              onClick={() => {
                dismiss()
                onAnswer()
              }}
            >
              {translate('agentHub.orb.bot.answer', 'Answer')}
            </Button>
          ) : null}
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={!bot}
            onClick={() => {
              if (bot) {
                void openBotHomeTab(bot)
              }
              dismiss()
            }}
          >
            {translate('agentHub.orb.bot.home', 'Home')}
          </Button>
        </>
      ) : null}
      {bubble.kind === 'other' ? (
        <>
          <Button
            type="button"
            size="xs"
            variant="link"
            onClick={() => onAnswer(`${bubble.botKey}:${bubble.uid}`)}
          >
            {translate('agentHub.orb.bot.answer', 'Answer')}
          </Button>
          <Button type="button" size="xs" variant="ghost" onClick={dismiss}>
            {translate('agentHub.orb.bot.later', 'Later')}
          </Button>
        </>
      ) : null}
      {bubble.kind === 'suggestion' ? (
        <>
          <Button
            type="button"
            size="xs"
            variant="link"
            disabled={!bot}
            onClick={() => {
              if (bot) {
                void startSuggestion(bot, bubble.suggestionId)
              }
              dismiss()
            }}
          >
            {translate('agentHub.orb.bot.start', 'Start')}
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => {
              if (bot) {
                void dismissSuggestion(bot, bubble.suggestionId)
              }
              dismiss()
            }}
          >
            {translate('agentHub.orb.bot.dismiss', 'Dismiss')}
          </Button>
        </>
      ) : null}
    </div>
  )
}

/** The ask card beside the sphere: the bot's question answered in place, Open and Later in its footer. */
export function AgentHubOrbBotAskCard({
  entry,
  onLater
}: {
  entry: OrbAskEntry
  onLater: (entry: OrbAskEntry) => void
}): React.JSX.Element {
  return (
    <AgentHubBotAskBlock
      key={entry.key}
      bot={entry.bot}
      item={entry.item}
      actions={
        <>
          <Button
            type="button"
            variant="link-muted"
            size="inlineInherit"
            className="text-xs"
            onClick={() => void openBotItemInHome(entry.bot, entry.item.uid)}
          >
            {translate('agentHub.bots.ask.openItem', 'Open #{{number}}', {
              number: entry.item.number
            })}
          </Button>
          <Button
            type="button"
            variant="link-muted"
            size="inlineInherit"
            className="text-xs"
            onClick={() => onLater(entry)}
          >
            {translate('agentHub.bots.ask.later', 'Later')}
          </Button>
        </>
      }
    />
  )
}

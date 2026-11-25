import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { reviewAccessRequest } from '@/lib/bot-access-requests'
import {
  getAutomationTargetFromHostId,
  runAutomationNowForTarget
} from '../automations/hosts/automation-host-client'
import { manageConnectors } from '../bots/AddConnectorDialog'
import { botConnectorTitleText } from '../bots/bot-connector-titles'
import { openBotSession } from '../bots/bot-session-open'
import { openBotItemInHome } from '../bots/items/bot-item-open'
import { dismissSuggestion, startSuggestion } from '../bots/bot-up-next-actions'
import { AgentHubAlertQuickOptions } from './AgentHubAlertQuickOptions'
import { AgentHubBotAskView } from './AgentHubBotAskView'
import { AgentHubRequestCard } from './AgentHubRequestCard'
import { agentHubAlertText } from './agent-hub-alert-text'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'
import { useAgentHubBotAskSteps } from './use-agent-hub-bot-ask-steps'
import type { AgentHubBotAlert, AgentHubBotAlertSubject } from './agent-hub-alerts'
import type { Bot } from '../../../../shared/bot-types'

type Subject<T extends AgentHubBotAlertSubject['type']> = Extract<
  AgentHubBotAlertSubject,
  { type: T }
>

function LaterButton({ onLater }: { onLater: () => void }): React.JSX.Element {
  return (
    <Button size="xs" variant="ghost" onClick={onLater}>
      {translate('agentHub.botBubble.later', 'Later')}
    </Button>
  )
}

/** The open question, answered in place; the bubble stays until it is answered or put off. */
export function AgentHubBotAskBody({
  bot,
  subject,
  onLater,
  onSettled
}: {
  bot: Bot
  subject: Subject<'item'>
  onLater: () => void
  /** The ask was answered here or elsewhere: the bubble shows Answered and closes. */
  onSettled: () => void
}): React.JSX.Element {
  const { item } = subject
  const ask = useAgentHubBotAskSteps(bot, item)
  const settled = ask.phase === 'answered' || ask.phase === 'closed'
  useEffect(() => {
    if (settled) {
      onSettled()
    }
  }, [settled, onSettled])
  if (ask.phase === 'closed') {
    return (
      <p className="text-[13px] text-muted-foreground">
        {translate('agentHub.botBubble.answered', 'Answered')}
      </p>
    )
  }
  return (
    <AgentHubBotAskView
      ask={ask}
      variant="plain"
      actions={
        <>
          <LaterButton onLater={onLater} />
          <Button size="xs" variant="ghost" onClick={() => void openBotItemInHome(bot, item.uid)}>
            {translate('agentHub.botBubble.openItem', 'Open #{{value0}}', { value0: item.number })}
          </Button>
        </>
      }
    />
  )
}

export function AgentHubBotSignInBody({
  bot,
  subject,
  onLater
}: {
  bot: Bot
  subject: Subject<'signin'>
  onLater: () => void
}): React.JSX.Element {
  const service = botConnectorTitleText(subject.connector.title)
  return (
    <>
      <p className="text-[13px] text-foreground/85">
        {translate('agentHub.botBubble.signIn', 'Sign in to {{value0}} so I can keep going.', {
          value0: service
        })}
      </p>
      <div className="flex items-center justify-end gap-1">
        <LaterButton onLater={onLater} />
        <Button size="xs" onClick={() => manageConnectors(bot, subject.key)}>
          {translate('agentHub.botBubble.signInAction', 'Sign in')}
        </Button>
      </div>
    </>
  )
}

export function AgentHubBotAccessBody({
  subject,
  onLater
}: {
  subject: Subject<'access'>
  onLater: () => void
}): React.JSX.Element {
  const { request } = subject
  return (
    <>
      <p className="text-[13px] text-foreground/85">
        {translate('agentHub.botBubble.access', '{{value0}} asks to talk to me on {{value1}}.', {
          value0: request.requester.name || request.requester.handle,
          value1: request.workspaceName
        })}
      </p>
      <div className="flex items-center justify-end gap-1">
        <LaterButton onLater={onLater} />
        <Button size="xs" onClick={() => reviewAccessRequest(request)}>
          {translate('agentHub.botBubble.accessReview', 'Review')}
        </Button>
      </div>
    </>
  )
}

export function AgentHubBotRunsBody({
  bot,
  subject
}: {
  bot: Bot
  subject: Subject<'runs'>
}): React.JSX.Element {
  const { runs } = subject
  const [first] = runs
  const failed = runs.filter((run) => run.failed).length
  const [again, setAgain] = useState<'idle' | 'started' | 'failed'>('idle')
  // Why only a single run: a summary has no one run to repeat.
  const rerun = runs.length === 1 && first?.failed ? first : null
  const text =
    runs.length === 1 && first
      ? first.failed
        ? translate('agentHub.botBubble.runFailed', '{{value0}} did not finish.', {
            value0: first.name
          })
        : translate('agentHub.botBubble.runDone', '{{value0}} is done.', { value0: first.name })
      : translate(
          'agentHub.botBubble.runsSummary',
          '{{value0}} runs finished, {{value1}} did not.',
          {
            value0: runs.length - failed,
            value1: failed
          }
        )
  const sessionId = first?.sessionId ?? null
  return (
    <>
      <p className="text-[13px] break-words text-foreground/85">{text}</p>
      <div className="flex items-center justify-end gap-1">
        {rerun ? (
          <Button
            size="xs"
            variant="ghost"
            disabled={again === 'started'}
            onClick={() => {
              setAgain('started')
              void runAutomationNowForTarget(
                { id: rerun.automationId, runContext: undefined },
                getAutomationTargetFromHostId(bot.hostId)
              ).catch(() => setAgain('failed'))
            }}
          >
            {again === 'failed'
              ? translate('agentHub.botBubble.runAgainFailed', 'Could not start')
              : translate('agentHub.botBubble.runAgain', 'Run again')}
          </Button>
        ) : null}
        {sessionId ? (
          <>
            <Button size="xs" variant="ghost" onClick={() => openBotSession(bot, sessionId)}>
              {translate('agentHub.botBubble.openChat', 'Open chat')}
            </Button>
            {rerun ? null : (
              <Button size="xs" onClick={() => openBotSession(bot, sessionId)}>
                {translate('agentHub.botBubble.reply', 'Reply')}
              </Button>
            )}
          </>
        ) : null}
      </div>
    </>
  )
}

/** A bot's chat or worker pane: what it says, its quick answers, and the way into it. */
export function AgentHubBotThreadBody({
  subject,
  failed,
  answerKeys,
  onOpen,
  onSettled
}: {
  subject: Subject<'thread'>
  failed: boolean
  answerKeys: boolean
  onOpen: () => void
  onSettled: () => void
}): React.JSX.Element {
  const { alert } = subject
  const text = agentHubAlertText(alert)
  return (
    <>
      {text ? (
        <p
          data-failed={failed || undefined}
          className="line-clamp-4 text-[13px] break-words text-foreground/85"
        >
          {text}
        </p>
      ) : null}
      {alert.kind !== 'done' ? (
        <AgentHubAlertQuickOptions
          alert={alert}
          answerKeys={answerKeys}
          onOpen={onOpen}
          onAnswered={onSettled}
        />
      ) : null}
      <div className="flex items-center justify-end gap-1">
        <Button size="xs" variant="ghost" onClick={onOpen}>
          {translate('agentHub.botBubble.openChat', 'Open chat')}
        </Button>
        {alert.kind === 'done' && subject.origin !== 'worker' ? (
          <Button size="xs" onClick={onOpen}>
            {translate('agentHub.botBubble.reply', 'Reply')}
          </Button>
        ) : null}
      </div>
    </>
  )
}

export function AgentHubBotRequestBody({
  subject,
  presentation,
  onOpen,
  onDismiss
}: {
  subject: Subject<'request'>
  presentation: AgentHubRequestPresentation
  onOpen: () => void
  onDismiss: () => void
}): React.JSX.Element {
  return (
    <AgentHubRequestCard
      item={subject.alert}
      presentation={presentation}
      compact
      bare
      onOpen={onOpen}
      onDismiss={onDismiss}
    />
  )
}

/** An idea the bot has for its owner: start it, or let it go. */
export function AgentHubBotSuggestionBody({
  bot,
  subject,
  onClose,
  onOpenInbox
}: {
  bot: Bot
  subject: Subject<'suggestion'>
  onClose: () => void
  onOpenInbox?: () => void
}): React.JSX.Element {
  const { suggestion } = subject
  return (
    <>
      <p className="text-[13px] font-medium text-foreground">{suggestion.title}</p>
      <p className="line-clamp-2 text-xs text-muted-foreground">{suggestion.why}</p>
      <div className="flex items-center justify-end gap-1">
        {onOpenInbox ? (
          <Button size="xs" variant="ghost" onClick={onOpenInbox}>
            {translate('agentHub.botBubble.openInbox', 'Open in Inbox')}
          </Button>
        ) : null}
        <Button
          size="xs"
          variant="ghost"
          onClick={() => {
            void dismissSuggestion(bot, suggestion.id)
            onClose()
          }}
        >
          {translate('agentHub.botBubble.suggestionDismiss', 'Dismiss')}
        </Button>
        <Button
          size="xs"
          onClick={() => {
            void startSuggestion(bot, suggestion.id)
            onClose()
          }}
        >
          {translate('agentHub.botBubble.suggestionYes', 'Yes')}
        </Button>
      </div>
    </>
  )
}

export function botAlertFrom(alert: AgentHubBotAlert): string | null {
  const { subject } = alert.bot
  switch (subject.type) {
    case 'item':
      return translate('agentHub.botBubble.fromHome', 'Home chat · #{{value0}}', {
        value0: subject.item.number
      })
    case 'signin':
      return botConnectorTitleText(subject.connector.title)
    case 'access':
      return subject.request.workspaceName
    case 'runs':
      return subject.runs.length === 1 ? (subject.runs[0]?.name ?? null) : null
    case 'thread':
      return subject.origin === 'worker'
        ? translate('agentHub.botBubble.fromWorker', 'Worker · {{value0}}', {
            value0: subject.alert.thread.agentType
          })
        : subject.origin === 'home'
          ? translate('agentHub.botBubble.fromHomeChat', 'Home chat')
          : subject.alert.thread.paneTitle || null
    case 'request':
      return subject.alert.request.caller.title ?? null
    case 'suggestion':
      return translate('agentHub.botBubble.fromSuggestion', 'Suggestion')
  }
}

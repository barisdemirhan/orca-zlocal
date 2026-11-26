import { Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { formatShortTimeAgo } from '@/lib/time-format/short-time-ago'
import type { AgentSleptPrompt } from '../../../../shared/agent-status/contracts/agent-status-types'
import { activityThreadRowCopy } from '../activity/threads/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { HubAvatar } from './AgentHubStateMarks'
import { HubChip, HubCrumb } from './AgentHubInlineLabels'
import {
  HubApprovalSummary,
  HubOptionList,
  HubReplyField,
  questionOptions
} from './AgentHubAnswerBody'
import type { AgentHubLocation } from './agent-hub-pane-target'
import { paneTargetFromThread } from './agent-hub-pane-target'
import {
  composeSleptAnswerMessage,
  deliverSleptAnswer,
  readSleptPrompt,
  SLEPT_RETRY_MESSAGE
} from './agent-hub-slept-answer'
import { sleptPromptKey, useSleptDelivery } from './agent-hub-slept-delivery-store'

/**
 * A sleeping agent's saved question. Answering wakes it, waits until it is idle and sends the
 * answer as a message that quotes the question: option keystrokes mean nothing to a resumed agent.
 */
export function AgentHubSleptPromptCard({
  thread,
  prompt,
  location,
  now,
  stateSince,
  children
}: {
  thread: AgentPaneThread
  prompt: AgentSleptPrompt
  location: AgentHubLocation
  now: number
  stateSince: number
  /** The card's footer actions. */
  children?: React.ReactNode
}): React.JSX.Element {
  const copy = activityThreadRowCopy(thread)
  const view = readSleptPrompt(prompt, thread.agentType)
  const key = sleptPromptKey(thread.paneKey, prompt)
  const delivery = useSleptDelivery(key)
  const busy = delivery?.phase === 'waking' || delivery?.phase === 'sending'
  const locked = busy || delivery?.phase === 'sent'
  const send = (message: string): void => {
    void deliverSleptAnswer(paneTargetFromThread(thread, copy.taskTitle), prompt, message)
  }
  const questions = view?.kind === 'question' ? view.questions : []
  const lone = questions.length === 1 && !questions[0]!.multiSelect ? questions[0]! : null
  const permission = view?.kind === 'permission' ? view : null
  const questionTexts = questions.map((question) => question.question)
  return (
    <section
      aria-label={copy.taskTitle}
      data-agent-hub-slept-card={thread.paneKey}
      className="relative animate-in rounded-xl border border-foreground/[0.08] bg-foreground/[0.035] px-3.5 pt-3.5 pb-2.5 duration-200 fade-in-0 slide-in-from-right-1"
    >
      <div className="mb-2.5 truncate text-sm font-semibold">{copy.taskTitle}</div>
      <div className="flex items-center gap-2.5">
        <HubAvatar agentType={thread.agentType} kind="ask" />
        <div className="min-w-0 text-[13px]">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">@{thread.agentType}</span>
            <HubChip tone="ask">
              {permission
                ? translate('agentHub.slept.needsPermission', 'needs permission')
                : translate('agentHub.card.asking', 'asking')}
            </HubChip>
            <span className="font-mono text-[11px] text-muted-foreground/70">
              {formatShortTimeAgo(stateSince, now)}
            </span>
          </div>
          <HubCrumb location={location} />
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Moon className="size-3.5" />
        {permission
          ? translate(
              'agentHub.slept.permissionHint',
              'Asleep. Waking it asks again; the permission prompt then appears here.'
            )
          : translate(
              'agentHub.slept.questionHint',
              'Asleep. Your answer goes as a message once it wakes.'
            )}
      </p>
      {permission ? (
        <>
          <HubApprovalSummary tool={permission.toolName} command={permission.detail ?? undefined} />
          <Button
            className="mt-2.5"
            size="sm"
            disabled={locked}
            onClick={() => send(SLEPT_RETRY_MESSAGE)}
          >
            {translate('agentHub.slept.wakeAndRetry', 'Wake and retry')}
          </Button>
        </>
      ) : lone ? (
        <>
          <div className="mt-3 mb-2 text-sm leading-snug font-semibold">{lone.question}</div>
          <HubOptionList
            options={questionOptions(lone)}
            chosen={null}
            disabled={locked}
            onChoose={(index) => {
              const label = lone.options[index]?.label
              if (label) {
                send(composeSleptAnswerMessage(questionTexts, [label]))
              }
            }}
          />
        </>
      ) : questions.length > 1 ? (
        <ul className="mt-3 list-disc pl-4 text-sm leading-snug font-semibold">
          {questions.map((question) => (
            <li key={question.question}>{question.question}</li>
          ))}
        </ul>
      ) : null}
      {permission || questions.length === 0 ? null : (
        <HubReplyField
          placeholder={translate('agentHub.slept.wakeAndAnswer', 'Wake and answer…')}
          disabled={locked}
          onSend={(text) => {
            send(composeSleptAnswerMessage(questionTexts, [text]))
            return true
          }}
        />
      )}
      {delivery ? (
        <div role="status" className="mt-2 text-xs text-muted-foreground">
          {delivery.phase === 'waking'
            ? translate('agentHub.slept.waking', 'Waking the agent…')
            : delivery.phase === 'sending'
              ? translate('agentHub.slept.waitingReady', 'Waiting until it is ready…')
              : delivery.phase === 'sent'
                ? translate('agentHub.slept.sent', 'Sent')
                : null}
          {delivery.phase === 'failed' ? (
            <span className="flex items-center gap-2 text-destructive">
              {delivery.error ?? translate('agentHub.slept.deliverFailed', "Couldn't deliver yet.")}
              <Button size="xs" variant="outline" onClick={() => send(delivery.message)}>
                {translate('agentHub.slept.sendAgain', 'Send again')}
              </Button>
            </span>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

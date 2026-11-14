import { getConnectionId } from '@/lib/workspace/ownership/connection-context'
import { runtimeEnvironmentIdOrLocalUnlessTwin } from '@/lib/workspace/ownership/worktree-runtime-owner'
import { AgentHubPeekChips } from './AgentHubPeekChips'
import { Button } from '@/components/ui/button'
import { AgentHubActionTooltip } from './AgentHubShortcut'
import { useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import { ArrowUpRight, PictureInPicture2, X } from 'lucide-react'
import { useAppStore } from '@/store'
import { formatAgentTypeLabel } from '../../../../shared/agent-status/presentation/agent-type-label'
import { formatShortTimeAgo } from '@/lib/time-format/short-time-ago'
import { submitPromptToAgentPty } from '@/lib/agent-session/messaging/paste/agent-paste-draft'
import { translate } from '@/i18n/i18n'
import { activityThreadRowCopy } from '../activity/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import {
  NativeChatInteractiveCard,
  type NativeChatInteractiveCardControl
} from '../native-chat/prompts/NativeChatInteractiveCard'
import { nativeChatApprovalAcceptKey } from '../../../../shared/native-chat/native-chat-agent-support'
import { nativeChatCardDismissKey } from '../../../../shared/native-chat/input/native-chat-prompt-dismiss-key'
import { HubAvatar } from './AgentHubStateMarks'
import { HubChip, HubCrumb, HubKeys } from './AgentHubInlineLabels'
import {
  HubApprovalSummary,
  HubOptionList,
  HubReplyField,
  questionOptions,
  type AgentHubAnswerOption
} from './AgentHubAnswerBody'
import { agentHubAlwaysAllowKey, readApprovalTool } from './agent-hub-approval'
import { agentHubStateSince } from './agent-hub-lists'
import { dismissAgentHubCard } from './agent-hub-answered-cards'
import { resolveAgentHubPtyId, type AgentHubLocation } from './agent-hub-pane-target'
import { quickAnswerTargetOf, useAgentHubQuickAnswer } from './use-agent-hub-quick-answer'

export { AGENT_HUB_CARD_KEY_GUARD_MS } from './use-agent-hub-quick-answer'

// Why a pause: the agent needs a beat to leave its approval prompt before the instruction lands.
const DENY_THEN_INSTRUCT_DELAY_MS = 400

export type AgentHubCardControl = NativeChatInteractiveCardControl

function CardAction({
  icon,
  label,
  keys,
  actionId,
  onClick
}: {
  icon: React.ReactNode
  label: string
  keys: string[]
  actionId?: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <AgentHubActionTooltip label={label} actionId={actionId}>
      <Button type="button" variant="ghost" size="xs" tabIndex={-1} onClick={onClick}>
        {icon}
        {label}
        <HubKeys keys={keys} />
      </Button>
    </AgentHubActionTooltip>
  )
}

/**
 * The waiting agent's card: its question or approval, answered with the same keystrokes the
 * chat surface sends (SSH included). Multi-question and multi-select prompts keep the full
 * native wizard.
 */
export function AgentHubAttentionCard({
  thread,
  location,
  now,
  popoutKeys,
  controlRef,
  onJump,
  onPopout
}: {
  thread: AgentPaneThread
  location: AgentHubLocation
  now: number
  popoutKeys: string[]
  controlRef: Ref<AgentHubCardControl>
  onJump: () => void
  onPopout: () => void
}): React.JSX.Element {
  const { paneKey } = thread
  const tabId = thread.tab.id
  const quick = useAgentHubQuickAnswer(quickAnswerTargetOf(thread))
  const { card, send, ptyId, chosen, canAnswer, simpleQuestion, approval, cardKey } = quick
  const interactivePrompt = useAppStore(
    (s) => s.agentStatusByPaneKey[paneKey]?.interactivePrompt ?? null
  )
  const nativeControlRef = useRef<NativeChatInteractiveCardControl>(null)
  // The native card no longer hides itself after an answer: hide it until a different prompt
  // arrives, and forget the dismissal once the prompt clears so an identical later one shows.
  const nativeCardKey = useMemo(() => nativeChatCardDismissKey(card), [card])
  const [dismissedNativeKey, setDismissedNativeKey] = useState<string | null>(null)
  if (card === null && dismissedNativeKey !== null) {
    setDismissedNativeKey(null)
  }
  const nativeCardDismissed = dismissedNativeKey !== null && dismissedNativeKey === nativeCardKey
  // The deny option first asks for an instruction; Enter on an empty field denies plainly.
  const [instructing, setInstructing] = useState(false)
  const replyRef = useRef<HTMLInputElement>(null)
  const copy = activityThreadRowCopy(thread)
  const agentLabel = formatAgentTypeLabel(thread.agentType)
  const command = approval?.detail
  const alwaysAllowKey = approval ? agentHubAlwaysAllowKey(thread.agentType) : null
  const approvalOptions: (AgentHubAnswerOption & { send: string })[] = approval
    ? [
        {
          id: 'allow-once',
          label: translate('agentHub.card.allowOnce', 'Yes, run it once'),
          // Why: OpenCode accepts with Enter, not a number; same key as the chat approval card.
          send: nativeChatApprovalAcceptKey(thread.agentType)
        },
        ...(alwaysAllowKey && command
          ? [
              {
                id: 'always-allow',
                label: (
                  <>
                    {translate('agentHub.card.alwaysAllow', 'Always allow')}{' '}
                    <code className="font-mono text-xs text-foreground">
                      {command.split(' ').slice(0, 2).join(' ')}
                    </code>
                  </>
                ),
                send: alwaysAllowKey
              }
            ]
          : []),
        {
          id: 'deny',
          label: translate('agentHub.card.denyInstead', 'No, tell {{value0}} what to do instead', {
            value0: agentLabel
          }),
          send: '',
          deny: true
        }
      ]
    : []

  const denyIndex = approvalOptions.length - 1

  const choose = (index: number): boolean => {
    if (simpleQuestion) {
      return quick.choose(index)
    }
    if (approval) {
      // Why its own list: the card also offers "always allow" and a deny that asks what to do instead.
      const option = approvalOptions[index]
      if (!option || !canAnswer || chosen !== null) {
        return false
      }
      if (option.deny && !instructing) {
        setInstructing(true)
        requestAnimationFrame(() => replyRef.current?.focus())
        return true
      }
      return quick.answerApproval(index, option.deny ? null : option.send) !== null
    }
    return nativeControlRef.current?.chooseOption(index) ?? false
  }
  useImperativeHandle(controlRef, () => ({
    chooseOption: (index) => quick.keysArmed() && choose(index)
  }))

  // Why the agent's host: an SSH or paired-runtime agent reads the image from its own disk.
  const pasteImage = (): Promise<string | null> => {
    const state = useAppStore.getState()
    return window.api.ui.saveClipboardImageAsTempFile({
      connectionId: getConnectionId(thread.worktree.id) ?? null,
      runtimeEnvironmentId: runtimeEnvironmentIdOrLocalUnlessTwin(state, thread.worktree.id) ?? null
    })
  }

  const reply = async (text: string): Promise<boolean> => {
    if (simpleQuestion) {
      return new Promise((resolve) => {
        if (!quick.reply(text, resolve)) {
          resolve(false)
        }
      })
    }
    if (!ptyId || !approval || chosen !== null) {
      return false
    }
    if (!(await quick.answerApproval(denyIndex, null))) {
      return false
    }
    if (!text) {
      return true
    }
    setTimeout(() => {
      // Why re-check: the pane may have closed, or the hub been turned off, during the delay.
      const state = useAppStore.getState()
      if (
        state.settings?.experimentalAgentHub === true &&
        resolveAgentHubPtyId(state, tabId, paneKey) === ptyId
      ) {
        void submitPromptToAgentPty({ tabId, ptyId, content: text })
      }
    }, DENY_THEN_INSTRUCT_DELAY_MS)
    return true
  }
  const hideLabel = translate('agentHub.card.hide', 'Hide until it asks again')

  const lastMessage = thread.currentAgentEntry?.lastAssistantMessageIsToolOutput
    ? undefined
    : thread.currentAgentEntry?.lastAssistantMessage?.trim()
  const waitingText =
    card?.kind === 'question'
      ? (card.prompt.questions[0]?.question ?? copy.statusLine)
      : approval
        ? [approval.title, approval.detail].filter(Boolean).join(' ')
        : copy.statusLine

  return (
    <section
      aria-label={copy.taskTitle}
      data-agent-hub-attention-card={paneKey}
      className="relative animate-in rounded-xl border border-foreground/[0.08] bg-foreground/[0.035] px-3.5 pt-3.5 pb-2.5 duration-200 fade-in-0 slide-in-from-right-1"
    >
      <div className="mb-2.5 flex items-start gap-2">
        <div className="min-w-0 flex-1 truncate text-sm font-semibold">{copy.taskTitle}</div>
        <AgentHubActionTooltip label={hideLabel}>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            tabIndex={-1}
            aria-label={hideLabel}
            data-agent-hub-card-hide
            className="-mt-1 -mr-1.5"
            // Why no answer: the agent keeps waiting and counting; the card returns when it asks again.
            onClick={() => dismissAgentHubCard(cardKey, 'inbox')}
          >
            <X />
          </Button>
        </AgentHubActionTooltip>
      </div>
      <div className="flex items-center gap-2.5">
        <HubAvatar agentType={thread.agentType} kind="ask" />
        <div className="min-w-0 text-[13px]">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">@{thread.agentType}</span>
            <HubChip tone="ask">
              {approval
                ? translate('agentHub.card.needsApproval', 'needs approval')
                : translate('agentHub.card.asking', 'asking')}
            </HubChip>
            <span className="font-mono text-[11px] text-muted-foreground/70">
              {formatShortTimeAgo(agentHubStateSince(thread), now)}
            </span>
          </div>
          <HubCrumb location={location} />
        </div>
      </div>

      {canAnswer && simpleQuestion ? (
        <>
          <div className="mt-3.5 mb-2 text-sm leading-snug font-semibold">
            {simpleQuestion.question}
          </div>
          <HubOptionList
            options={questionOptions(simpleQuestion)}
            chosen={chosen}
            disabled={chosen !== null}
            onChoose={choose}
          />
          <HubReplyField
            placeholder={translate('agentHub.card.replyTo', 'Reply to @{{value0}}…', {
              value0: thread.agentType
            })}
            disabled={chosen !== null}
            onSend={reply}
            onPasteImage={pasteImage}
          />
        </>
      ) : canAnswer && approval ? (
        <>
          <div className="mt-3.5 mb-2 text-sm leading-snug font-semibold">
            {lastMessage || approval.title}
          </div>
          <HubApprovalSummary tool={readApprovalTool(interactivePrompt)} command={command} />
          <HubOptionList
            options={approvalOptions}
            chosen={chosen ?? (instructing ? denyIndex : null)}
            disabled={chosen !== null}
            onChoose={choose}
          />
          <HubReplyField
            inputRef={replyRef}
            placeholder={
              instructing
                ? translate(
                    'agentHub.card.insteadOrDeny',
                    'Tell it what to do instead, or press Enter to just deny…'
                  )
                : translate('agentHub.card.instead', 'Tell it what to do instead…')
            }
            disabled={chosen !== null}
            allowEmpty={instructing}
            onSend={reply}
            onPasteImage={pasteImage}
          />
        </>
      ) : canAnswer && card ? (
        <div className="mt-3">
          {nativeCardDismissed || chosen !== null || quick.pending ? null : (
            <NativeChatInteractiveCard
              card={card}
              send={send}
              finishAnswerAfterUnmount
              onDismiss={() => setDismissedNativeKey(nativeCardKey)}
              layout="embedded"
              highlightRecommended
              controlRef={nativeControlRef}
            />
          )}
        </div>
      ) : (
        // Why: the structured prompt can be absent (older hook, relay trimmed it) or the
        // pane is still attaching; the agent is waiting all the same, so show what it said.
        <div className="mt-3.5 text-sm">
          {waitingText ? <p className="line-clamp-4 break-words">{waitingText}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {translate(
              'agentHub.attention.answerInTerminal',
              'Answer this one in its terminal: pop it out or open it in Orca.'
            )}
          </p>
        </div>
      )}

      <AgentHubPeekChips
        text={[simpleQuestion?.question, lastMessage, waitingText].filter(Boolean).join('\n')}
        worktree={thread.worktree}
      />
      <div className="mt-2 -ml-1.5 flex gap-1">
        <CardAction
          icon={<ArrowUpRight className="size-3.5" />}
          label={translate('agentHub.card.jump', 'Jump to terminal')}
          keys={['↵']}
          onClick={onJump}
        />
        <CardAction
          icon={<PictureInPicture2 className="size-3.5" />}
          label={translate('agentHub.row.popOut', 'Pop out')}
          keys={popoutKeys}
          actionId="agentHub.popOut"
          onClick={onPopout}
        />
      </div>
    </section>
  )
}

import { AgentHubActionTooltip } from './AgentHubShortcut'
import { useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import { ArrowUpRight, PictureInPicture2 } from 'lucide-react'
import { useAppStore } from '@/store'
import { formatAgentTypeLabel } from '@/lib/agent-status'
import { formatShortTimeAgo } from '@/lib/short-time-ago'
import { submitPromptToAgentPty } from '@/lib/agent-paste-draft'
import { translate } from '@/i18n/i18n'
import { activityThreadRowCopy } from '../activity/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import {
  NativeChatInteractiveCard,
  type NativeChatInteractiveCardControl
} from '../native-chat/NativeChatInteractiveCard'
import { nativeChatApprovalAcceptKey } from '../../../../shared/native-chat-agent-support'
import { parseInteractivePrompt } from '../native-chat/native-chat-interactive-prompt'
import { useNativeChatCanSend } from '../native-chat/use-native-chat-can-send'
import { useNativeChatInteractiveSend } from '../native-chat/use-native-chat-interactive-send'
import { HubAvatar, HubChip, HubCrumb, HubKeys } from './AgentHubAtoms'
import {
  HubApprovalSummary,
  HubOptionList,
  HubReplyField,
  questionOptions,
  type AgentHubAnswerOption
} from './AgentHubAnswerBody'
import { agentHubAlwaysAllowKey, readApprovalTool } from './agent-hub-approval'
import { agentHubStateSince } from './agent-hub-lists'
import { resolveAgentHubPtyId, type AgentHubLocation } from './agent-hub-pane-target'
import { useAgentHubLivePty } from './use-agent-hub-live-pty'

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
      <button
        type="button"
        tabIndex={-1}
        onClick={onClick}
        className="flex items-center gap-1.5 rounded-[7px] px-[7px] py-[5px] text-xs text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
      >
        {icon}
        {label}
        <HubKeys keys={keys} />
      </button>
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
  const interactivePrompt = useAppStore(
    (s) => s.agentStatusByPaneKey[paneKey]?.interactivePrompt ?? null
  )
  const toolName = useAppStore((s) => {
    const entry = s.agentStatusByPaneKey[paneKey]
    return entry?.interactivePrompt ? (entry.toolName ?? null) : null
  })
  const card = useMemo(
    () => parseInteractivePrompt(interactivePrompt, toolName ?? undefined, thread.agentType),
    [interactivePrompt, toolName, thread.agentType]
  )
  const ptyId = useAgentHubLivePty(thread.worktree.id, tabId, paneKey, false)
  const send = useNativeChatInteractiveSend(tabId, paneKey, ptyId, thread.agentType)
  const nativeControlRef = useRef<NativeChatInteractiveCardControl>(null)
  const [chosen, setChosen] = useState<number | null>(null)
  // The deny option first asks for an instruction; Enter on an empty field denies plainly.
  const [instructing, setInstructing] = useState(false)
  const replyRef = useRef<HTMLInputElement>(null)
  const copy = activityThreadRowCopy(thread)
  const agentLabel = formatAgentTypeLabel(thread.agentType)
  // Why canSend: a mobile-owned PTY refuses desktop input, as in the chat composer.
  const canSend = useNativeChatCanSend(ptyId)
  const canAnswer = card !== null && ptyId !== null && canSend

  const question =
    card?.kind === 'question' && card.prompt.questions.length === 1
      ? (card.prompt.questions[0] ?? null)
      : null
  const simpleQuestion = question && !question.multiSelect ? question : null
  const approval = card?.kind === 'approval' ? card.approval : null
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

  const submitAnswer = (
    selections: Parameters<typeof send.sendAnswer>[1],
    marker: number
  ): void => {
    if (card?.kind !== 'question') {
      return
    }
    setChosen(marker)
    // A refused or lost delivery hands the card back for another try.
    const result = send.sendAnswer(card.prompt, selections, (delivered) => {
      if (!delivered) {
        setChosen(null)
      }
    })
    if (result.settleAfterMs <= 0) {
      setChosen(null)
    }
  }

  const choose = (index: number): boolean => {
    if (!canAnswer || chosen !== null) {
      return false
    }
    if (simpleQuestion && card?.kind === 'question') {
      if (!simpleQuestion.options[index]) {
        return false
      }
      submitAnswer([{ indices: [index] }], index)
      return true
    }
    const option = approvalOptions[index]
    if (approval) {
      if (!option) {
        return false
      }
      if (option.deny && !instructing) {
        setInstructing(true)
        requestAnimationFrame(() => replyRef.current?.focus())
        return true
      }
      setChosen(index)
      if (option.deny) {
        send.cancelAsk()
      } else {
        send.sendRaw(option.send)
      }
      return true
    }
    return nativeControlRef.current?.chooseOption(index) ?? false
  }
  useImperativeHandle(controlRef, () => ({ chooseOption: choose }))

  const reply = (text: string): void => {
    if (!ptyId || chosen !== null) {
      return
    }
    if (simpleQuestion && card?.kind === 'question') {
      submitAnswer([{ indices: [], other: text }], -1)
      return
    }
    if (approval) {
      setChosen(denyIndex)
      send.cancelAsk()
      if (!text) {
        return
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
    }
  }

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
      className="relative animate-in rounded-[14px] border border-foreground/[0.08] bg-foreground/[0.035] px-3.5 pt-3.5 pb-2.5 duration-200 fade-in-0 slide-in-from-right-1"
    >
      <div className="mb-2.5 truncate pr-5 text-[15px] font-semibold tracking-[-0.01em]">
        {copy.taskTitle}
      </div>
      <div className="flex items-center gap-2.5">
        <HubAvatar agentType={thread.agentType} kind="ask" />
        <div className="min-w-0 text-[12.5px]">
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
          />
        </>
      ) : canAnswer ? (
        <div className="mt-3">
          <NativeChatInteractiveCard
            card={card}
            send={send}
            canSend
            layout="embedded"
            highlightRecommended
            controlRef={nativeControlRef}
          />
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

      <div className="mt-2 -ml-1.5 flex gap-1">
        <CardAction
          icon={<ArrowUpRight className="size-[13px]" />}
          label={translate('agentHub.card.jump', 'Jump to terminal')}
          keys={['↵']}
          onClick={onJump}
        />
        <CardAction
          icon={<PictureInPicture2 className="size-[13px]" />}
          label={translate('agentHub.row.popOut', 'Pop out')}
          keys={popoutKeys}
          actionId="agentHub.popOut"
          onClick={onPopout}
        />
      </div>
    </section>
  )
}

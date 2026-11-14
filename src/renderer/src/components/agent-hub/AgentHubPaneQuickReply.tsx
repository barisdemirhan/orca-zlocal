import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/react/shallow'
import { Loader2, MessageSquareReply, SendHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { isPairedWebClientWindow } from '@/app-shell/chrome/desktop-window-chrome'
import {
  focusPanePreservingOverlays,
  type OverlayFocusPane
} from '@/lib/pane-manager/pane-focus/pane-overlay-focus'
import type { ManagedPane } from '@/lib/pane-manager/pane-manager-types'
import { useAppStore } from '@/store'
import { makePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import { paneIsCoveredByNativeChat } from '../terminal-pane/chat/native-chat-covered-pane'
import {
  NativeChatInteractiveCard,
  type NativeChatInteractiveCardControl
} from '../native-chat/prompts/NativeChatInteractiveCard'
import { HubOptionList } from './AgentHubAnswerBody'
import { HubAvatar } from './AgentHubStateMarks'
import { HubDictateButton } from './AgentHubDictateButton'
import { markAgentHubPaneQuickReplyOpen } from './agent-hub-pane-quick-reply-presence'
import { AgentHubActionTooltip } from './AgentHubShortcut'
import {
  agentHubCardKey,
  dismissAgentHubCard,
  showAgentHubCardsAgain,
  useAgentHubCardDismissed
} from './agent-hub-answered-cards'
import { useAgentHubPreferences } from './use-agent-hub-settings'
import {
  AGENT_HUB_ANSWERED_VISIBLE_MS,
  useAgentHubQuickAnswer,
  type AgentHubQuickAnswerTarget
} from './use-agent-hub-quick-answer'

type PaneLike = Pick<ManagedPane, 'id' | 'leafId'> & OverlayFocusPane

/**
 * The agent's question or approval as a card in its pane's corner, answered with a click, a
 * number key or a few words; Esc hands the keys back to the terminal, which still takes the
 * answer as it always did.
 */
function PaneQuickReplyCard({
  pane,
  target
}: {
  pane: PaneLike
  target: AgentHubQuickAnswerTarget
}): React.JSX.Element | null {
  const quick = useAgentHubQuickAnswer(target)
  const dismissed = useAgentHubCardDismissed(quick.cardKey, 'pane')
  const rootRef = useRef<HTMLDivElement>(null)
  const [text, setText] = useState('')
  const [sentText, setSentText] = useState<string | null>(null)
  const [gone, setGone] = useState(false)
  const chosen = quick.chosen
  const answerStarted = chosen !== null || quick.pending
  // Answered here or elsewhere: show it briefly, then leave.
  useEffect(() => {
    if (chosen === null || quick.pending) {
      setGone(false)
      return undefined
    }
    const timer = setTimeout(() => setGone(true), AGENT_HUB_ANSWERED_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [chosen, quick.pending])
  // Several questions, or one with several picks, take the agent's full question card.
  const fullCard =
    quick.options.length === 0 && quick.canAnswer && quick.card?.kind === 'question'
      ? quick.card
      : null
  const nativeControlRef = useRef<NativeChatInteractiveCardControl>(null)
  const nativeAnswerInputRef = useRef<HTMLTextAreaElement>(null)
  const nativeAnswerTextareaRef = useRef<HTMLTextAreaElement>(null)
  const answerable = quick.options.length > 0 || fullCard !== null
  const shown = answerable && !dismissed && !gone
  // While it is open, the mirror's mic leaves dictation to the card's own field.
  useEffect(
    () => (shown ? markAgentHubPaneQuickReplyOpen(target.paneKey) : undefined),
    [shown, target.paneKey]
  )
  // Why only from its own terminal: a card must not take the keys from the pane being typed in,
  // nor from a chat composer that covers this one. Layout-timed, so the cleanup still sees the
  // card in the document.
  useLayoutEffect(() => {
    if (!shown) {
      return undefined
    }
    const root = rootRef.current
    const terminal = pane.container.querySelector('.xterm-helper-textarea')
    if (terminal && terminal === document.activeElement) {
      root?.focus({ preventScroll: true })
    }
    return () => {
      // Leaving with the keys (the prompt cleared elsewhere) hands them back to the terminal.
      if (root?.contains(document.activeElement)) {
        focusPanePreservingOverlays(pane)
      }
    }
  }, [shown, pane])
  if (!shown) {
    if (!dismissed || gone || !answerable) {
      return null
    }
    // Closed for this prompt: a small handle in the corner brings the card back while it stands.
    const reopenLabel = translate('agentHub.quick.reopen', 'Show the quick reply card')
    return createPortal(
      <AgentHubActionTooltip label={reopenLabel}>
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          aria-label={reopenLabel}
          data-agent-hub-pane-quick-reply-handle={target.paneKey}
          className="absolute bottom-3 left-3 z-[45]"
          onClick={() => {
            // The terminal takes the keys first, so the returning card takes them from it.
            focusPanePreservingOverlays(pane)
            showAgentHubCardsAgain([quick.cardKey], 'pane')
          }}
        >
          <MessageSquareReply />
        </Button>
      </AgentHubActionTooltip>,
      pane.container
    )
  }
  const close = (): void => {
    dismissAgentHubCard(quick.cardKey, 'pane')
    focusPanePreservingOverlays(pane)
  }
  const answered = (sent: boolean): void => {
    if (sent) {
      setText('')
      focusPanePreservingOverlays(pane)
    }
  }
  return createPortal(
    <>
      <div aria-hidden className="pointer-events-none absolute inset-0 z-40 bg-background/40" />
      <div
        ref={rootRef}
        tabIndex={-1}
        role="group"
        aria-label={quick.question ?? translate('agentHub.quick.title', 'Quick reply')}
        data-agent-hub-pane-quick-reply={target.paneKey}
        aria-busy={answerStarted}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) {
            return
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            close()
            return
          }
          // Digits answer unless typed into a reply field.
          if (
            !/^[1-9]$/.test(event.key) ||
            event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLTextAreaElement
          ) {
            return
          }
          const index = Number(event.key) - 1
          // The full card moves on to its next question itself; it leaves once all are sent.
          const taken = fullCard
            ? quick.keysArmed() && (nativeControlRef.current?.chooseOption(index) ?? false)
            : quick.chooseByKey(index, answered)
          if (taken) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
        className="pointer-events-auto absolute bottom-3 left-3 z-[45] max-h-[calc(100%-1.5rem)] w-[min(26rem,calc(100%-1.5rem))] animate-in scrollbar-sleek overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-floating outline-none duration-150 fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none! focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-center gap-2 px-3 pt-2.5">
          <HubAvatar agentType={target.agentType} kind="ask" />
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">@{target.agentType}</span>{' '}
            {quick.card?.kind === 'question'
              ? translate('agentHub.alert.asking', 'is asking')
              : translate('agentHub.alert.needsApproval', 'needs approval')}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={translate('agentHub.quick.close', 'Close and answer in the terminal (esc)')}
            onClick={close}
          >
            <X />
          </Button>
        </div>
        {fullCard && !answerStarted ? (
          <div className="px-3 pt-2 pb-2.5">
            <NativeChatInteractiveCard
              card={fullCard}
              send={quick.send}
              finishAnswerAfterUnmount
              // Delivered: the card leaves and the terminal takes the keys back.
              onDismiss={() => {
                setGone(true)
                focusPanePreservingOverlays(pane)
              }}
              layout="embedded"
              highlightRecommended
              controlRef={nativeControlRef}
              answerInputRef={nativeAnswerInputRef}
              answerTextareaRef={nativeAnswerTextareaRef}
              answerAccessory={
                <HubDictateButton
                  compact
                  targetInputRef={nativeAnswerInputRef}
                  targetTextareaRef={nativeAnswerTextareaRef}
                />
              }
            />
          </div>
        ) : fullCard ? null : (
          <>
            {quick.question ? (
              <p className="px-3 pt-1.5 text-[13px] leading-snug font-medium break-words">
                {quick.question}
              </p>
            ) : null}
            <div className="px-3 pt-0.5">
              <HubOptionList
                density="compact"
                options={quick.options}
                chosen={chosen}
                disabled={answerStarted || !quick.canAnswer}
                onChoose={(index) => quick.choose(index, answered)}
              />
            </div>
          </>
        )}
        {quick.simpleQuestion && !answerStarted ? (
          <form
            className="@container/hub-reply mx-3 mt-2 mb-2.5 flex min-w-0 items-center gap-1 rounded-lg border border-foreground/[0.08] bg-background/60 py-0.5 pr-0.5 pl-2.5 focus-within:border-foreground/20"
            onSubmit={(event) => {
              event.preventDefault()
              const reply = text.trim()
              quick.reply(reply, (delivered) => {
                if (delivered) {
                  setSentText(reply)
                }
                answered(delivered)
              })
            }}
          >
            <input
              value={text}
              disabled={!quick.canAnswer}
              onChange={(event) => setText(event.target.value)}
              placeholder={translate('agentHub.quick.ownWords', 'Your own answer…')}
              aria-label={translate('agentHub.quick.ownWords', 'Your own answer…')}
              className="min-w-0 flex-1 bg-transparent py-1 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70"
            />
            <HubDictateButton compact />
            <Button
              type="submit"
              variant="ghost"
              size="icon-xs"
              disabled={!quick.canAnswer || text.trim() === ''}
              aria-label={translate('agentHub.quick.send', 'Send')}
            >
              <SendHorizontal />
            </Button>
          </form>
        ) : answerStarted ? (
          // Why: the keys take a moment to reach the agent; a still card reads as frozen.
          <div
            role="status"
            className="mx-3 mt-2 mb-2.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
          >
            <Loader2
              aria-hidden
              className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
            />
            <span className="shrink-0">{translate('agentHub.quick.sending', 'Sending…')}</span>
            {sentText ? <span className="min-w-0 truncate text-foreground">{sentText}</span> : null}
          </div>
        ) : fullCard ? null : (
          <div className="pb-2.5" />
        )}
      </div>
    </>,
    pane.container
  )
}

/** The prompt's agent, read beside the status entry that announced it. */
function PaneQuickReply({
  pane,
  worktreeId,
  tabId,
  paneKey,
  stateSince,
  cardKey
}: {
  pane: PaneLike
  worktreeId: string
  tabId: string
  paneKey: string
  stateSince: number
  /** The prompt's own key: a new question in the same turn starts a fresh card. */
  cardKey: string
}): React.JSX.Element | null {
  const agentType = useAppStore((s) => s.agentStatusByPaneKey[paneKey]?.agentType ?? null)
  // A chat view over this pane shows the agent's own card; the terminal below it is not in use.
  if (!agentType || paneIsCoveredByNativeChat(pane)) {
    return null
  }
  return (
    <PaneQuickReplyCard
      key={cardKey}
      pane={pane}
      target={{ worktreeId, tabId, paneKey, agentType, stateSince }}
    />
  )
}

/**
 * One card per pane whose agent is asking, mounted from the terminal tab's chrome. Only while
 * Agent Hub and its "Quick reply in the terminal" setting are on, and never in a paired
 * web-client window, where the rest of the hub is absent too.
 */
export function AgentHubPaneQuickReplyPortals({
  panes,
  tabId,
  worktreeId
}: {
  panes: readonly PaneLike[]
  tabId: string
  worktreeId: string
}): React.JSX.Element | null {
  const enabled = useAppStore((s) => s.settings?.experimentalAgentHub === true)
  const { paneQuickReply } = useAgentHubPreferences()
  const active = enabled && paneQuickReply && !isPairedWebClientWindow()
  // Why a key, not the entry: a pane's status changes often; only a prompt's arrival matters.
  const promptByPaneKey = useAppStore(
    useShallow((s): Record<string, string> => {
      if (!active) {
        return {}
      }
      const prompts: Record<string, string> = {}
      for (const pane of panes) {
        const paneKey = makePaneKey(tabId, pane.leafId)
        const entry = s.agentStatusByPaneKey[paneKey]
        if (entry?.interactivePrompt && entry.agentType) {
          prompts[paneKey] =
            `${entry.stateStartedAt}\u0000${agentHubCardKey(paneKey, entry.stateStartedAt, entry.interactivePrompt)}`
        }
      }
      return prompts
    })
  )
  return (
    <>
      {panes.map((pane) => {
        const paneKey = makePaneKey(tabId, pane.leafId)
        const prompt = promptByPaneKey[paneKey]
        if (prompt === undefined) {
          return null
        }
        const [stateSince, cardKey] = prompt.split('\u0000')
        return (
          <PaneQuickReply
            key={paneKey}
            pane={pane}
            worktreeId={worktreeId}
            tabId={tabId}
            paneKey={paneKey}
            stateSince={Number(stateSince)}
            cardKey={cardKey ?? paneKey}
          />
        )
      })}
    </>
  )
}

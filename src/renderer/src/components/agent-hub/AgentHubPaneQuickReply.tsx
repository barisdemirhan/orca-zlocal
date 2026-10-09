import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/react/shallow'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { isPairedWebClientWindow } from '@/lib/desktop-window-chrome'
import {
  focusPanePreservingOverlays,
  type OverlayFocusPane
} from '@/lib/pane-manager/pane-overlay-focus'
import type { ManagedPane } from '@/lib/pane-manager/pane-manager'
import { useAppStore } from '@/store'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import { paneIsCoveredByNativeChat } from '../terminal-pane/native-chat-covered-pane'
import { HubOptionList } from './AgentHubAnswerBody'
import { HubAvatar } from './AgentHubStateMarks'
import { HubKeys } from './AgentHubInlineLabels'
import {
  agentHubCardKey,
  dismissAgentHubCard,
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
  const [gone, setGone] = useState(false)
  const chosen = quick.chosen
  // Answered here or elsewhere: show it briefly, then leave.
  useEffect(() => {
    if (chosen === null) {
      return undefined
    }
    const timer = setTimeout(() => setGone(true), AGENT_HUB_ANSWERED_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [chosen])
  const shown = quick.options.length > 0 && !dismissed && !gone
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
    return null
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
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            close()
            return
          }
          // Digits answer unless typed into the reply field.
          if (
            /^[1-9]$/.test(event.key) &&
            !(event.target instanceof HTMLInputElement) &&
            quick.chooseByKey(Number(event.key) - 1)
          ) {
            event.preventDefault()
            event.stopPropagation()
            answered(true)
          }
        }}
        className="pointer-events-auto absolute bottom-3 left-3 z-[45] w-[min(26rem,calc(100%-1.5rem))] animate-in rounded-xl border border-border bg-popover text-popover-foreground shadow-floating outline-none duration-150 fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none! focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-center gap-2 px-3 pt-2.5">
          <HubAvatar agentType={target.agentType} kind="ask" />
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">@{target.agentType}</span>{' '}
            {quick.simpleQuestion
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
            disabled={chosen !== null || !quick.canAnswer}
            onChoose={(index) => answered(quick.choose(index))}
          />
        </div>
        <div className="flex items-center gap-2 px-3 pt-2 pb-2.5 text-[11px] text-muted-foreground">
          {quick.simpleQuestion && chosen === null ? (
            <form
              className="flex min-w-0 flex-1 items-center gap-1 rounded-lg border border-foreground/[0.08] bg-background/60 py-0.5 pr-0.5 pl-2.5 focus-within:border-foreground/20"
              onSubmit={(event) => {
                event.preventDefault()
                answered(quick.reply(text))
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
            </form>
          ) : (
            <span className="flex-1" />
          )}
          <span className="flex shrink-0 items-center gap-1">
            <HubKeys keys={['esc']} />
            {translate('agentHub.quick.escHint', 'terminal')}
          </span>
        </div>
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
  stateSince
}: {
  pane: PaneLike
  worktreeId: string
  tabId: string
  paneKey: string
  stateSince: number
}): React.JSX.Element | null {
  const agentType = useAppStore((s) => s.agentStatusByPaneKey[paneKey]?.agentType ?? null)
  // A chat view over this pane shows the agent's own card; the terminal below it is not in use.
  if (!agentType || paneIsCoveredByNativeChat(pane)) {
    return null
  }
  return (
    <PaneQuickReplyCard
      key={agentHubCardKey(paneKey, stateSince)}
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
  // Why only the start time: a pane's status changes often; only a prompt's arrival matters.
  const sinceByPaneKey = useAppStore(
    useShallow((s): Record<string, number> => {
      if (!active) {
        return {}
      }
      const since: Record<string, number> = {}
      for (const pane of panes) {
        const paneKey = makePaneKey(tabId, pane.leafId)
        const entry = s.agentStatusByPaneKey[paneKey]
        if (entry?.interactivePrompt && entry.agentType) {
          since[paneKey] = entry.stateStartedAt
        }
      }
      return since
    })
  )
  return (
    <>
      {panes.map((pane) => {
        const paneKey = makePaneKey(tabId, pane.leafId)
        const stateSince = sinceByPaneKey[paneKey]
        return stateSince === undefined ? null : (
          <PaneQuickReply
            key={paneKey}
            pane={pane}
            worktreeId={worktreeId}
            tabId={tabId}
            paneKey={paneKey}
            stateSince={stateSince}
          />
        )
      })}
    </>
  )
}

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/react/shallow'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import { HubAvatar } from './AgentHubStateMarks'
import { HubChip, HubKeys } from './AgentHubInlineLabels'
import {
  dismissAgentHubPaneQuickReply,
  useAgentHubPaneQuickReplyDismissed
} from './agent-hub-pane-quick-reply-dismissal'
import { useAgentHubPreferences } from './use-agent-hub-settings'
import {
  useAgentHubQuickAnswer,
  type AgentHubQuickAnswerTarget
} from './use-agent-hub-quick-answer'

type PaneLike = { id: number; leafId: string; container: HTMLElement }

// The card lingers this long after an answer, so what went out can be read.
const ANSWERED_VISIBLE_MS = 1000

function focusTerminal(container: HTMLElement): void {
  container.querySelector<HTMLElement>('.xterm-helper-textarea')?.focus({ preventScroll: true })
}

/**
 * The agent's question or approval as a card in its pane's corner, answered with a click, a
 * number key or a few words; Esc hands the keys back to the terminal, which still takes the
 * answer as it always did.
 */
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
  return agentType ? (
    <PaneQuickReplyCard
      pane={pane}
      target={{ worktreeId, tabId, paneKey, agentType, stateSince }}
    />
  ) : null
}

function PaneQuickReplyCard({
  pane,
  target
}: {
  pane: PaneLike
  target: AgentHubQuickAnswerTarget
}): React.JSX.Element | null {
  const quick = useAgentHubQuickAnswer(target)
  const dismissed = useAgentHubPaneQuickReplyDismissed(target.paneKey, target.stateSince)
  const rootRef = useRef<HTMLDivElement>(null)
  const [text, setText] = useState('')
  const [gone, setGone] = useState(false)
  const chosen = quick.chosen
  // Answered here or on the hub's card: show it briefly, then leave.
  useEffect(() => {
    if (chosen === null) {
      setGone(false)
      return undefined
    }
    const timer = setTimeout(() => setGone(true), ANSWERED_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [chosen])
  const shown = quick.options.length > 0 && !dismissed && !gone
  // Why only from its own terminal: a card must not take the keys from the pane being typed in.
  useEffect(() => {
    if (shown && pane.container.contains(document.activeElement)) {
      rootRef.current?.focus({ preventScroll: true })
    }
  }, [shown, pane.container])
  if (!shown) {
    return null
  }
  const close = (): void => {
    dismissAgentHubPaneQuickReply(target.paneKey, target.stateSince)
    focusTerminal(pane.container)
  }
  const answered = (sent: boolean): void => {
    if (sent) {
      setText('')
      focusTerminal(pane.container)
    }
  }
  return createPortal(
    <>
      <div aria-hidden className="pointer-events-none absolute inset-0 z-40 bg-background/40" />
      <div
        ref={rootRef}
        tabIndex={-1}
        role="dialog"
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
            quick.choose(Number(event.key) - 1)
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
            {quick.reply
              ? translate('agentHub.alert.asking', 'is asking')
              : translate('agentHub.alert.needsApproval', 'needs approval')}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={translate('agentHub.quick.close', 'Close and answer in the terminal (esc)')}
            className="text-muted-foreground hover:text-foreground"
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
        <div className="flex flex-col gap-1 px-3 pt-2">
          {quick.options.map((option, index) => (
            <button
              key={option.id}
              type="button"
              disabled={chosen !== null || !quick.canAnswer}
              data-chosen={chosen === index}
              data-recommended={option.recommended === true}
              onClick={() => answered(quick.choose(index))}
              className="flex items-start gap-2 rounded-lg border border-foreground/[0.08] px-2.5 py-1.5 text-left text-[13px] hover:bg-foreground/[0.05] disabled:cursor-default disabled:opacity-60 data-[chosen=true]:border-status-success/60 data-[chosen=true]:opacity-100 data-[recommended=true]:border-ring/60"
            >
              <span className="mt-0.5 shrink-0">
                {chosen === index ? (
                  <Check aria-hidden className="size-3 text-status-success" />
                ) : (
                  <HubKeys keys={[String(index + 1)]} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block">
                  {option.label}
                  {option.recommended ? (
                    <HubChip>{translate('agentHub.quick.recommended', 'Recommended')}</HubChip>
                  ) : null}
                </span>
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 px-3 pt-2 pb-2.5 text-[11px] text-muted-foreground">
          {quick.reply && chosen === null ? (
            <form
              className="flex min-w-0 flex-1 items-center gap-1 rounded-lg border border-foreground/[0.08] bg-background/60 py-0.5 pr-0.5 pl-2.5 focus-within:border-foreground/20"
              onSubmit={(event) => {
                event.preventDefault()
                answered(quick.reply?.(text) ?? false)
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

/**
 * One card per pane whose agent is asking, mounted from the terminal tab's chrome. Only while
 * Agent Hub and its "Quick reply in the terminal" setting are on.
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
  const targets = useAppStore(
    useShallow((s) =>
      enabled && paneQuickReply
        ? panes.flatMap((pane) => {
            const paneKey = makePaneKey(tabId, pane.leafId)
            const entry = s.agentStatusByPaneKey[paneKey]
            // Why the key alone: the pane's status changes often; only a prompt's arrival matters.
            return entry?.interactivePrompt && entry.agentType
              ? [`${pane.id}\u0000${paneKey}\u0000${entry.stateStartedAt ?? entry.updatedAt}`]
              : []
          })
        : []
    )
  )
  if (targets.length === 0) {
    return null
  }
  return (
    <>
      {targets.map((key) => {
        const [paneId, paneKey, since] = key.split('\u0000')
        const pane = panes.find((candidate) => String(candidate.id) === paneId)
        if (!pane || !paneKey) {
          return null
        }
        return (
          <PaneQuickReply
            key={paneKey}
            pane={pane}
            worktreeId={worktreeId}
            tabId={tabId}
            paneKey={paneKey}
            stateSince={Number(since)}
          />
        )
      })}
    </>
  )
}

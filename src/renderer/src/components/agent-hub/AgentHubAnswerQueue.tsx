import { useEffect, useRef, useState } from 'react'
import * as DialogPrimitive from 'radix-ui/dialog'
import { Check, MessagesSquare, SquareTerminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogPortal } from '@/components/ui/dialog'
import { ShortcutKeyCombo } from '@/components/ShortcutKeyCombo'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import type { AgentHubOpenRequest } from './AgentHubPanel'
import type { AgentHubLocation, AgentHubPaneTarget } from './agent-hub-pane-target'
import { threadOpenRequest } from './agent-hub-pane-target'
import type { AgentHubRequestBase } from '../../../../shared/agent-hub-requests'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'
import { STATUS_BAR_RESERVE_HEIGHT } from '../sidebar/workspace-chrome-metrics'
import { useAgentHubPreferences } from './use-agent-hub-settings'
import { AGENT_HUB_CARD_KEY_GUARD_MS } from './use-agent-hub-quick-answer'
import { useAgentHubAnswerQueueController } from './agent-hub-answer-queue-controller'
import { useAgentHubAnswerQueueSource } from './agent-hub-answer-queue-source'
import { isAnswerQueueEditable } from './agent-hub-answer-queue'
import {
  openAgentHubAnswerQueue,
  useAgentHubAnswerQueueState
} from './agent-hub-answer-queue-store'
import {
  AgentHubAnswerQueueAnswerObserver,
  AgentHubAnswerQueueCard,
  AgentHubAnswerQueueRequestCard
} from './AgentHubAnswerQueueCard'
import type { NativeChatInteractiveCardControl } from '../native-chat/prompts/NativeChatInteractiveCard'

type Props = {
  threads: readonly AgentPaneThread[]
  locationOf: (target: AgentHubPaneTarget) => AgentHubLocation
  requestPresentationOf: (host: string, request: AgentHubRequestBase) => AgentHubRequestPresentation
  onJump: (request: AgentHubOpenRequest) => void
}

function AgentHubAnswerQueuePill(): React.JSX.Element | null {
  const enabled = useAgentHubAnswerQueueState((state) => state.enabled)
  const count = useAgentHubAnswerQueueState((state) => state.count)
  if (!enabled || count === 0) {
    return null
  }
  return (
    <Button type="button" variant="ghost" size="xs" onClick={openAgentHubAnswerQueue}>
      <MessagesSquare className="size-3.5" />
      {translate('agentHub.answerQueue.waiting', '{{count}} waiting', { count })}
    </Button>
  )
}

export function AgentHubAnswerQueue(props: Props): React.JSX.Element | null {
  const preferences = useAgentHubPreferences()
  const inSettings = useAppStore((state) => state.activeView === 'settings')
  const bottom = useAppStore((state) => (state.statusBarVisible ? STATUS_BAR_RESERVE_HEIGHT : 0))
  const source = useAgentHubAnswerQueueSource(props.threads)
  const enabled = preferences.answerQueue
  const controller = useAgentHubAnswerQueueController({
    enabled,
    automatically: preferences.answerQueueOpening !== 'shortcut',
    includeApprovals: preferences.answerQueueIncludeApprovals,
    source: source.items,
    unverifiableHosts: source.unverifiableHosts,
    verifiableHosts: source.verifiableHosts
  })
  const skipRestore = useRef(false)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const controlRef = useRef<NativeChatInteractiveCardControl>(null)
  const answerInputRef = useRef<HTMLTextAreaElement>(null)
  const current = controller.queue[0]
  const [displayed, setDisplayed] = useState(current)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (!controller.open || !displayed || !current || displayed.id === current.id) {
      setDisplayed(current)
      setLeaving(false)
      return
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setDisplayed(current)
      return
    }
    setLeaving(true)
    const timer = setTimeout(() => {
      setDisplayed(current)
      setLeaving(false)
    }, 200)
    return () => clearTimeout(timer)
  }, [current, displayed, controller.open])
  const shownAt = useRef(0)
  const dialogOpen = controller.open && !inSettings
  const shownId = displayed?.id
  useEffect(() => {
    // A just-opened or just-swapped card is unread, so a keystroke meant for the terminal must not answer it.
    shownAt.current = Date.now()
  }, [dialogOpen, shownId])
  if (!enabled) {
    return null
  }
  const item = displayed?.id === current?.id ? current : displayed
  const hostUnavailable = item ? !source.verifiableHosts.has(item.hostId) : false
  const unavailable = hostUnavailable || leaving
  const total = controller.completed + controller.queue.length
  const presentation =
    item?.kind === 'request' ? props.requestPresentationOf(item.item.host, item.item.request) : null
  const target =
    item?.kind === 'pane' ? threadOpenRequest(item.thread).target : presentation?.target
  const mod = navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'
  const jump = (): void => {
    if (!item || !target) {
      return
    }
    skipRestore.current = true
    controller.close()
    props.onJump({ target, thread: item.kind === 'pane' ? item.thread : null })
  }
  return (
    <>
      <AgentHubAnswerQueuePill />
      {source.items.map((candidate) =>
        candidate.kind === 'pane' ? (
          <AgentHubAnswerQueueAnswerObserver
            key={candidate.id}
            item={candidate}
            onResolved={controller.resolved}
          />
        ) : null
      )}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            controller.close()
          }
        }}
      >
        <DialogPortal>
          <div
            aria-hidden
            data-agent-hub-answer-queue-shade
            style={{ bottom }}
            className="fixed inset-0 z-[49] bg-black/45"
            onMouseDown={(event) => event.preventDefault()}
          />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            data-agent-hub-answer-queue
            style={{ bottom }}
            onOpenAutoFocus={(event) => {
              event.preventDefault()
              skipRestore.current = false
              restoreFocusRef.current =
                document.activeElement instanceof HTMLElement ? document.activeElement : null
              columnRef.current?.focus({ preventScroll: true })
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              if (!skipRestore.current && restoreFocusRef.current?.isConnected) {
                restoreFocusRef.current.focus({ preventScroll: true })
              }
            }}
            onInteractOutside={(event) => event.preventDefault()}
            onEscapeKeyDown={(event) => {
              event.preventDefault()
              controller.close()
            }}
            onKeyDownCapture={(event) => {
              if (event.nativeEvent.isComposing || event.repeat) {
                return
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                controller.close()
                return
              }
              if (
                event.key === 'ArrowRight' &&
                (navigator.userAgent.includes('Mac') ? event.metaKey : event.ctrlKey)
              ) {
                event.preventDefault()
                event.stopPropagation()
                controller.later()
                return
              }
              if (Date.now() - shownAt.current < AGENT_HUB_CARD_KEY_GUARD_MS) {
                return
              }
              if (
                !unavailable &&
                event.key === 'Enter' &&
                !isAnswerQueueEditable(event.target) &&
                !(event.target instanceof Element && event.target.closest('button')) &&
                answerInputRef.current
              ) {
                event.preventDefault()
                event.stopPropagation()
                answerInputRef.current.dispatchEvent(
                  new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
                )
                return
              }
              if (
                !unavailable &&
                /^[1-9]$/.test(event.key) &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.altKey &&
                !isAnswerQueueEditable(event.target)
              ) {
                if (item?.kind === 'request') {
                  controller.markSending(item.id)
                }
                if (controlRef.current?.chooseOption(Number(event.key) - 1)) {
                  event.preventDefault()
                  event.stopPropagation()
                }
              }
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none"
          >
            <div
              className="flex max-h-full w-full max-w-[35rem] flex-col gap-2.5"
              tabIndex={-1}
              ref={columnRef}
            >
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <DialogPrimitive.Title className="font-semibold text-foreground">
                  {translate('agentHub.answerQueue.title', 'Answer queue')}
                </DialogPrimitive.Title>
                {total > 0 ? (
                  <span>
                    {Math.min(controller.completed + 1, total)} / {total}
                  </span>
                ) : null}
                <div aria-hidden className="flex min-w-0 flex-1 gap-1">
                  {Array.from({ length: total }, (_, index) => (
                    <span
                      key={index}
                      data-done={index < controller.completed}
                      data-current={index === controller.completed}
                      className="h-1 min-w-1 max-w-5 flex-1 rounded-full bg-muted data-[done=true]:bg-status-success data-[current=true]:bg-primary"
                    />
                  ))}
                </div>
                <Button type="button" variant="ghost" size="xs" onClick={controller.close}>
                  {translate('agentHub.answerQueue.exit', 'Exit')}
                  <ShortcutKeyCombo keys={['Esc']} />
                </Button>
              </div>
              <div className="relative min-h-0">
                {controller.queue.length > 1 ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -bottom-2.5 left-[3%] h-10 w-[94%] rounded-xl border border-border bg-popover opacity-55"
                  />
                ) : null}
                {controller.queue.length > 2 ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -bottom-5 left-[6%] h-10 w-[88%] rounded-xl border border-border bg-popover opacity-30"
                  />
                ) : null}
                <div
                  key={item?.id ?? 'caught-up'}
                  data-leaving={leaving}
                  className="relative flex max-h-[calc(100vh-12rem)] flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-popover p-3.5 text-popover-foreground shadow-floating scrollbar-sleek animate-in duration-200 fade-in-0 slide-in-from-bottom-2 data-[leaving=true]:-translate-y-2 data-[leaving=true]:opacity-0 transition-[opacity,transform] motion-reduce:animate-none! motion-reduce:transition-none!"
                >
                  {current && item ? (
                    item.kind === 'pane' ? (
                      <AgentHubAnswerQueueCard
                        item={item}
                        location={props.locationOf(threadOpenRequest(item.thread).target)}
                        unavailable={unavailable}
                        controlRef={controlRef}
                        answerInputRef={answerInputRef}
                        onResolved={controller.resolved}
                        onSending={controller.markSending}
                      />
                    ) : presentation ? (
                      <AgentHubAnswerQueueRequestCard
                        item={item}
                        presentation={presentation}
                        unavailable={unavailable}
                        controlRef={controlRef}
                        onSending={controller.markSending}
                        onResolved={controller.resolved}
                      />
                    ) : null
                  ) : (
                    <div role="status" className="flex items-center justify-center gap-2 py-8">
                      <Check className="size-5 text-status-success" />
                      {translate('agentHub.answerQueue.caughtUp', 'All caught up')}
                    </div>
                  )}
                  {hostUnavailable ? (
                    <p role="status" className="text-xs text-muted-foreground">
                      {translate(
                        'agentHub.answerQueue.unverifiable',
                        'Host connection is unverifiable. Reconnect to send your answer.'
                      )}
                    </p>
                  ) : null}
                </div>
              </div>
              {current ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-2">
                    <ShortcutKeyCombo keys={['1–9']} />
                    {translate('agentHub.answerQueue.pick', 'pick')}
                    <ShortcutKeyCombo keys={['↵']} />
                    {translate('agentHub.answerQueue.send', 'send')}
                    <ShortcutKeyCombo keys={[mod, '→']} />
                    {translate('agentHub.answerQueue.laterHint', 'later')}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="xs" onClick={controller.later}>
                      {translate('agentHub.answerQueue.later', 'Later')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={!target}
                      onClick={jump}
                    >
                      <SquareTerminal />
                      {translate('agentHub.answerQueue.openTerminal', 'Open in terminal')}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </>
  )
}

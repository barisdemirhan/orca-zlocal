import { useMemo, useState, type RefObject } from 'react'
import { ArrowLeft, History, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverArrow, PopoverContent } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate, getIntlLocale } from '@/i18n/i18n'
import { structuredAgentLabel } from '@/lib/structured-agent-session-launch-label'
import { useAppStore } from '@/store'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/status-bar-context-menu-policy'
import {
  useAgentHubOrbPanel,
  closeAgentHubOrbPanel,
  setAgentHubOrbDestination
} from './agent-hub-orb-panel-store'
import { useAgentHubOrbConversations } from './agent-hub-orb-conversations'
import { AgentHubOrbHistory } from './AgentHubOrbHistory'
import { openAgentHubOrb } from './agent-hub-orb-open'
import { cancelDictation } from './agent-hub-dictation-cancel'
import { readAgentHubDictationSession } from './agent-hub-dictation-origin'
import { isDictationRunning } from './agent-hub-mirror-mic-state'
import { agentHubInboxRequests, useAgentHubRequests } from './agent-hub-requests-store'
import { agentHubOrbRequest } from './agent-hub-orb-state'
import { AgentHubRequestCard } from './AgentHubRequestCard'
import type { AgentHubRequestBase } from '../../../../shared/agent-hub-requests'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'
import { useAnchorBinding } from './use-anchor-binding'

export function agentHubOrbAnchorRect(anchor: HTMLElement | null): DOMRect {
  return (
    anchor?.getBoundingClientRect() ??
    new DOMRect(window.innerWidth / 2, window.innerHeight - 40, 0, 0)
  )
}

export function AgentHubOrbPanel({
  anchorRef,
  side,
  docked,
  hidden,
  requestPresentationOf
}: {
  anchorRef: RefObject<HTMLElement | null>
  side: 'top' | 'bottom' | 'left' | 'right'
  docked: boolean
  hidden: boolean
  requestPresentationOf: (host: string, request: AgentHubRequestBase) => AgentHubRequestPresentation
}): React.JSX.Element | null {
  const session = useAgentHubOrbPanel((s) => s.session)
  const [anchored, setAnchored] = useState(false)
  useAnchorBinding(anchorRef, side, () => {
    setAnchored(true)
    return () => setAnchored(false)
  })
  const virtualRef = useMemo(
    () => ({ current: { getBoundingClientRect: () => agentHubOrbAnchorRect(anchorRef.current) } }),
    [anchorRef]
  )
  return (
    <Popover
      open={Boolean(session) && !hidden}
      onOpenChange={(next) => {
        if (!next) {
          closeAgentHubOrbPanel()
        }
      }}
    >
      <PopoverAnchor virtualRef={virtualRef} />
      {session ? (
        <PopoverContent
          side={anchored ? side : 'top'}
          align={docked || !anchored ? 'center' : 'end'}
          sideOffset={docked ? 12 : 8}
          collisionPadding={{ top: 8, bottom: 32, left: 8, right: 8 }}
          surface="panel"
          className="w-132 max-w-[calc(100vw-2rem)]"
          {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
          data-agent-hub-orb-panel
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            if (isDictationRunning(useAppStore.getState().dictationState)) {
              event.preventDefault()
              cancelDictation()
            }
          }}
          onInteractOutside={(event) => {
            if (event.target instanceof Node && anchorRef.current?.contains(event.target)) {
              event.preventDefault()
            }
          }}
        >
          <AgentHubOrbPanelBody
            sessionId={session.sessionId}
            tabId={session.tabId}
            requestPresentationOf={requestPresentationOf}
          />
          {anchored ? <PopoverArrow width={14} height={7} /> : null}
        </PopoverContent>
      ) : null}
    </Popover>
  )
}

function AgentHubOrbPanelBody({
  sessionId,
  tabId,
  requestPresentationOf
}: {
  sessionId: string
  tabId: string | undefined
  requestPresentationOf: (host: string, request: AgentHubRequestBase) => AgentHubRequestPresentation
}): React.JSX.Element {
  const history = useAgentHubOrbPanel((s) => !s.chatVisible)
  const setHistory = (next: boolean) => useAgentHubOrbPanel.setState({ chatVisible: !next })
  const [busy, setBusy] = useState(false)
  const [actionFailed, setActionFailed] = useState(false)
  const { conversations, error, refresh } = useAgentHubOrbConversations(sessionId, history)
  const conversation = conversations.find((entry) => entry.sessionId === sessionId)
  const tabAgent = useAppStore(
    (s) =>
      Object.values(s.unifiedTabsByWorktree)
        .flat()
        .find((tab) => tab.id === tabId)?.agentSessionAgent
  )
  const requests = agentHubInboxRequests(useAgentHubRequests()).filter(agentHubOrbRequest)
  const reopen = async (resumeId?: string) => {
    if (busy) {
      return
    }
    setBusy(true)
    setActionFailed(false)
    if (
      tabId &&
      isDictationRunning(useAppStore.getState().dictationState) &&
      readAgentHubDictationSession()?.pane?.tabId === tabId
    ) {
      cancelDictation()
    }
    try {
      if (!resumeId) {
        await window.api.agentHub.orb.close()
      }
      await openAgentHubOrb(resumeId ? { resume: { sessionId: resumeId } } : undefined)
      const next = useAgentHubOrbPanel.getState().session
      if (next && (resumeId ? next.sessionId === resumeId : next.sessionId !== sessionId)) {
        setHistory(false)
      }
      await refresh()
    } catch {
      setActionFailed(true)
    } finally {
      setBusy(false)
    }
  }
  const historyLabel = translate('auto.agentHub.orb.pastConversations', 'Past conversations')
  const backLabel = translate('auto.agentHub.orb.backToConversation', 'Back to conversation')
  const closeLabel = translate('agentHub.close', 'Close')
  const agent = conversation?.agent ?? tabAgent
  return (
    <section
      aria-label={translate('auto.agentHub.orb.title', 'Orb')}
      className="flex h-[min(640px,calc(100vh-96px))] min-h-0 flex-col"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        {history ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={backLabel}
                onClick={() => setHistory(false)}
              >
                <ArrowLeft />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{backLabel}</TooltipContent>
          </Tooltip>
        ) : null}
        <span className="text-sm font-semibold">
          {history ? historyLabel : translate('auto.agentHub.orb.title', 'Orb')}
        </span>
        {!history && agent ? (
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {structuredAgentLabel(agent)} ·{' '}
            {conversation?.model ?? translate('auto.agentHub.orb.agentDefault', 'Agent default')}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        {history ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={busy}
            onClick={() => {
              void reopen()
            }}
          >
            {translate('auto.agentHub.orb.newConversation', 'New')}
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={historyLabel}
                onClick={() => setHistory(true)}
              >
                <History />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{historyLabel}</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={closeLabel}
              onClick={closeAgentHubOrbPanel}
            >
              <X />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{closeLabel}</TooltipContent>
        </Tooltip>
      </header>
      {error || actionFailed ? (
        <div
          role="status"
          className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"
        >
          {translate('auto.agentHub.orb.historyFailed', 'Could not load conversations. Try again.')}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              void refresh()
            }}
          >
            {translate('common.retry', 'Retry')}
          </Button>
        </div>
      ) : null}
      {!history && conversation ? (
        <p className="shrink-0 truncate px-3 pt-2 text-xs text-muted-foreground">
          {conversation.title} ·{' '}
          {new Date(conversation.lastActiveAt).toLocaleString(getIntlLocale(), {
            dateStyle: 'short',
            timeStyle: 'short'
          })}
        </p>
      ) : null}
      {history ? (
        <AgentHubOrbHistory
          conversations={conversations}
          activeSessionId={sessionId}
          busy={busy}
          onReopen={(id) => {
            void reopen(id)
          }}
        />
      ) : null}
      {!history && requests.length > 0 ? (
        <div className="scrollbar-sleek max-h-64 shrink-0 overflow-y-auto p-3">
          {requests.map((item) => (
            <AgentHubRequestCard
              key={`${item.host}:${item.request.requestId}`}
              item={item}
              presentation={requestPresentationOf(item.host, item.request)}
            />
          ))}
        </div>
      ) : null}
      <div
        ref={setAgentHubOrbDestination}
        data-agent-hub-orb-chat-tab-id={tabId}
        className={history ? 'hidden' : 'relative min-h-0 flex-1 overflow-hidden'}
      />
    </section>
  )
}

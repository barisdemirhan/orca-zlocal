import { useState } from 'react'
import { ArrowLeft, History, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate, getIntlLocale } from '@/i18n/i18n'
import { structuredAgentLabel } from '@/lib/structured-agent-session-launch-label'
import { useAppStore } from '@/store'
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

import { agentHubOrbErrorMessage } from './agent-hub-orb-error'
export function AgentHubOrbConversation({
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
  const [failure, setFailure] = useState<{ message: string; resumeId?: string } | null>(null)
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
    setFailure(null)
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
      const opened = await openAgentHubOrb(
        resumeId ? { resume: { sessionId: resumeId } } : undefined
      )
      if (!opened) {
        setFailure({
          message: translate('auto.agentHub.orb.openFailed', 'Could not open Orb. Try again.'),
          resumeId
        })
        return
      }
      const next = useAgentHubOrbPanel.getState().session
      if (next && (resumeId ? next.sessionId === resumeId : next.sessionId !== sessionId)) {
        setHistory(false)
      }
      await refresh()
    } catch (error) {
      setFailure({
        message: agentHubOrbErrorMessage(
          error,
          translate('auto.agentHub.orb.openFailed', 'Could not open Orb. Try again.')
        ),
        resumeId
      })
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
        {!history ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={busy}
                aria-label={translate('auto.agentHub.orb.newConversation', 'New')}
                onClick={() => void reopen()}
              >
                <Plus />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{translate('auto.agentHub.orb.newConversation', 'New')}</TooltipContent>
          </Tooltip>
        ) : null}
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
      {error || failure ? (
        <div
          role="status"
          className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"
        >
          {failure?.message ??
            translate(
              'auto.agentHub.orb.historyFailed',
              'Could not load conversations. Try again.'
            )}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              if (failure) {
                void reopen(failure.resumeId)
              } else {
                void refresh()
              }
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

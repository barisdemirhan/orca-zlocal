import { useState } from 'react'
import { Button } from '@/components/ui/button'
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
import { AgentHubSettingsOrbSection } from './AgentHubSettingsOrbSection'
import { openAgentHubOrb } from './agent-hub-orb-open'
import { cancelDictation } from './agent-hub-dictation-cancel'
import {
  readAgentHubDictationSession,
  useAgentHubDictationSession
} from './agent-hub-dictation-origin'
import { isDictationRunning } from './agent-hub-mirror-mic-state'
import { agentHubInboxRequests, useAgentHubRequests } from './agent-hub-requests-store'
import type { AgentHubOrbState } from './agent-hub-orb-state'
import { agentHubCurrentOrbRequest } from './agent-hub-orb-request-owner'
import { AgentHubOrbStage } from './AgentHubOrbStage'
import { AgentHubOrbControls } from './AgentHubOrbControls'
import { AgentHubOrbConversationHeader } from './AgentHubOrbConversationHeader'
import { agentHubOrbPresentation } from './agent-hub-orb-presentation'
import type { AgentHubOrbVoiceValue } from './use-agent-hub-orb-voice'
import { toggleAgentHubOrb } from './agent-hub-orb-composer'
import { dispatchDictationControl } from '../dictation/dictation-control-events'
import { AgentHubRequestCard } from './AgentHubRequestCard'
import { AgentHubOrbRequestReceipt } from './AgentHubOrbRequestReceipt'
import type { AgentHubRequestBase } from '../../../../shared/agent-hub-requests'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'

import { agentHubOrbErrorMessage } from './agent-hub-orb-error'
export function AgentHubOrbConversation({
  sessionId,
  tabId,
  state,
  voice,
  visible,
  requestPresentationOf
}: {
  sessionId: string
  tabId: string | undefined
  state: AgentHubOrbState
  voice: AgentHubOrbVoiceValue
  visible: boolean
  requestPresentationOf: (host: string, request: AgentHubRequestBase) => AgentHubRequestPresentation
}): React.JSX.Element {
  const chatVisible = useAgentHubOrbPanel((s) => s.chatVisible)
  const presentation = useAgentHubOrbPanel((s) => s.presentation)
  const compact = useAgentHubOrbPanel((s) => s.compact)
  const nativeRequestPending = useAgentHubOrbPanel((s) => s.nativeRequestPending)
  const nativeRequestVisible = useAgentHubOrbPanel(
    (s) => s.nativeRequestVisible || s.nativeRequestPending
  )
  const showChat = chatVisible && presentation === 'chat' && !compact
  const dictation = useAgentHubDictationSession()
  const dictationState = useAppStore((s) => s.dictationState)
  const dictating = Boolean(
    tabId && dictation?.pane?.tabId === tabId && isDictationRunning(dictationState)
  )
  const [secondaryView, setSecondaryView] = useState<'history' | 'settings'>('history')
  const setView = (view: 'chat' | 'history' | 'settings') => {
    if (view !== 'chat') {
      void voice.stopLive()
      setSecondaryView(view)
    }
    useAgentHubOrbPanel.setState({
      chatVisible: view === 'chat',
      ...(view === 'chat' ? { presentation: 'chat', compact: false } : {})
    })
  }
  const history = !chatVisible && secondaryView === 'history'
  const showSettings = !chatVisible && secondaryView === 'settings'
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
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
  const requestState = useAgentHubRequests()
  const requests = agentHubInboxRequests(requestState).filter((item) =>
    agentHubCurrentOrbRequest(item, { host: 'local', sessionId })
  )
  const receipt = requestState.get('local')?.orbReceipts.get(sessionId)
  const currentRequest = nativeRequestPending ? undefined : requests[0]
  const hasRequest = nativeRequestPending || requests.length > 0
  const requestVisible = nativeRequestVisible || requests.length > 0 || receipt !== undefined
  const visual = agentHubOrbPresentation(state, voice, hasRequest)
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
      await voice.stopLive()
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
        setView('chat')
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
  const settingsLabel = translate('auto.agentHub.orb.settings', 'Orb settings')
  const agent = conversation?.agent ?? tabAgent
  return (
    <section
      aria-label={translate('auto.agentHub.orb.title', 'Orb')}
      className="flex h-[min(640px,calc(100vh-96px))] min-h-0 flex-col"
    >
      <AgentHubOrbConversationHeader
        history={history}
        settingsView={showSettings}
        chatVisible={chatVisible}
        busy={busy}
        agentLabel={
          agent
            ? `${structuredAgentLabel(agent)} · ${conversation?.model ?? translate('auto.agentHub.orb.agentDefault', 'Agent default')}`
            : null
        }
        onBack={() => setView('chat')}
        onHistory={() => setView('history')}
        onSettings={() => setView('settings')}
        onNew={() => {
          void reopen()
        }}
        onMinimize={() => useAgentHubOrbPanel.setState({ compact: true })}
        onClose={closeAgentHubOrbPanel}
      />
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
      {chatVisible && conversation ? (
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
      {showSettings && settings ? (
        <section
          aria-label={settingsLabel}
          className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto p-3"
        >
          <AgentHubSettingsOrbSection settings={settings} updateSettings={updateSettings} />
        </section>
      ) : null}
      <AgentHubOrbStage
        {...visual}
        inputMuted={voice.input === 'muted'}
        embedded={showChat}
        compact={compact}
        visible={visible && chatVisible}
        requestVisible={requestVisible}
        notice={
          voice.reason ??
          (agent === 'codex' && voice.capability === 'unsupported'
            ? translate(
                'auto.agentHub.orb.voiceUnavailable',
                'Live voice is unavailable on this host.'
              )
            : undefined)
        }
        request={
          currentRequest ? (
            <AgentHubRequestCard
              key={`${currentRequest.host}:${currentRequest.request.requestId}`}
              item={currentRequest}
              presentation={requestPresentationOf(currentRequest.host, currentRequest.request)}
            />
          ) : !nativeRequestVisible && receipt ? (
            <AgentHubOrbRequestReceipt host="local" receipt={receipt} />
          ) : null
        }
        controls={
          <AgentHubOrbControls
            voice={voice}
            codex={agent === 'codex'}
            orbView={!showChat}
            compact={compact}
            busy={busy}
            dictating={dictating}
            onShowChat={() =>
              useAgentHubOrbPanel.setState({ presentation: 'chat', compact: false })
            }
            onShowOrb={() => useAgentHubOrbPanel.setState({ presentation: 'orb', compact: false })}
            onCompact={() => useAgentHubOrbPanel.setState({ compact: !compact })}
            onText={() => {
              void voice
                .switchToText()
                .then(() => useAgentHubOrbPanel.setState({ presentation: 'chat', compact: false }))
            }}
            onDictate={() => {
              void voice.prepareDictation().then((ready) => {
                if (!ready) {
                  return
                }
                useAgentHubOrbPanel.setState({ presentation: 'chat', compact: false })
                requestAnimationFrame(toggleAgentHubOrb)
              })
            }}
            onStopDictation={() => dispatchDictationControl('stop')}
            onCancelDictation={cancelDictation}
            onHistory={() => setView('history')}
            onSettings={() => setView('settings')}
            onNew={() => {
              void reopen()
            }}
            onClose={closeAgentHubOrbPanel}
          />
        }
      />
      <div
        ref={setAgentHubOrbDestination}
        data-agent-hub-orb-chat-tab-id={tabId}
        className={showChat ? 'relative min-h-0 flex-1 overflow-hidden' : 'hidden'}
      />
    </section>
  )
}

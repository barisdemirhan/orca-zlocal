import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { structuredAgentLabel } from '@/lib/structured-agent-session-launch-label'
import { useAppStore } from '@/store'
import {
  useAgentHubOrbPanel,
  closeAgentHubOrbPanel,
  cancelAgentHubOrbLaunch,
  setAgentHubOrbDestination
} from './agent-hub-orb-panel-store'
import { useAgentHubOrbConversations } from './agent-hub-orb-conversations'
import { AgentHubOrbHistory } from './AgentHubOrbHistory'
import { AgentHubSettingsOrbSection } from './AgentHubSettingsOrbSection'
import { cancelDictation } from './agent-hub-dictation-cancel'
import { useAgentHubDictationSession } from './agent-hub-dictation-origin'
import { isDictationRunning } from './agent-hub-mirror-mic-state'
import { agentHubInboxRequests, useAgentHubRequests } from './agent-hub-requests-store'
import type { AgentHubOrbState } from './agent-hub-orb-state'
import { agentHubCurrentOrbRequest } from './agent-hub-orb-request-owner'
import { AgentHubOrbStage } from './AgentHubOrbStage'
import { agentHubOrbSphereAction } from './agent-hub-orb-sphere-action'
import { AgentHubOrbControls } from './AgentHubOrbControls'
import { AgentHubOrbConversationHeader } from './AgentHubOrbConversationHeader'
import { agentHubOrbPresentation } from './agent-hub-orb-presentation'
import { useAgentHubOrbAttention } from './agent-hub-orb-attention'
import type { AgentHubOrbVoiceValue } from './use-agent-hub-orb-voice'
import { finishAgentHubOrbDictationForText, toggleAgentHubOrb } from './agent-hub-orb-composer'
import { dispatchDictationControl } from '../dictation/dictation-control-events'
import { AgentHubRequestCard } from './AgentHubRequestCard'
import { AgentHubOrbRequestModal } from './AgentHubOrbRequestModal'
import { AgentHubOrbLiveControls } from './AgentHubOrbLiveControls'
import { AgentHubOrbQuickInput } from './AgentHubOrbQuickInput'
import type { AgentHubRequestBase } from '../../../../shared/agent-hub-requests'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'
import { AgentHubOrbFollowNotices } from './AgentHubOrbFollowNotices'
import { useAgentHubOrbAwarenessDelivery } from './use-agent-hub-orb-awareness-delivery'
import { useAgentHubOrbQuickWrite } from './use-agent-hub-orb-quick-write'
import { useAgentHubOrbReopen } from './use-agent-hub-orb-reopen'
import { openAgentHubMirrors } from './agent-hub-mirror-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { sleepAgentHubOrb } from './agent-hub-orb-sleep'

/** A written reply stays under the sphere this long; spoken captions keep their minute. */
const AGENT_HUB_ORB_REPLY_MS = 12_000

const sleep = (): void => {
  void sleepAgentHubOrb()
}

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
  const nativeRequestId = useAgentHubOrbPanel((s) => s.nativeRequestId)
  const nativeRequestVisible = useAgentHubOrbPanel(
    (s) => s.nativeRequestVisible || s.nativeRequestPending
  )
  const showChat = chatVisible && presentation === 'chat' && !compact
  const live =
    voice.connection === 'connecting' ||
    voice.connection === 'live' ||
    voice.connection === 'stopping'
  useAgentHubOrbAwarenessDelivery(tabId, voice)
  const openFollowTarget = (target: AgentHubPaneTarget): void => {
    openAgentHubMirrors([target])
  }
  const dictation = useAgentHubDictationSession()
  const dictationState = useAppStore((s) => s.dictationState)
  const dictating = Boolean(
    tabId && dictation?.pane?.tabId === tabId && isDictationRunning(dictationState)
  )
  const [secondaryView, setSecondaryView] = useState<'history' | 'settings'>('history')
  const setView = (view: 'chat' | 'history' | 'settings') => {
    cancelAgentHubOrbLaunch(sessionId, tabId)
    if (view !== 'chat') {
      void voice.stopLive()
      setSecondaryView(view)
    }
    useAgentHubOrbPanel.setState({
      chatVisible: view === 'chat',
      ...(view === 'chat' ? { presentation: 'chat', compact: false } : {})
    })
  }
  const showConversation = (): void => {
    cancelAgentHubOrbLaunch(sessionId, tabId)
    useAgentHubOrbPanel.setState({ presentation: 'chat', compact: false })
  }
  const history = !chatVisible && secondaryView === 'history'
  const showSettings = !chatVisible && secondaryView === 'settings'
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const { conversations, error, refresh } = useAgentHubOrbConversations(sessionId, history)
  const { busy, failure, reopen } = useAgentHubOrbReopen({
    sessionId,
    tabId,
    stopLive: voice.stopLive,
    refresh,
    onOpened: () => setView('chat')
  })
  const conversation = conversations.find((entry) => entry.sessionId === sessionId)
  const tabAgent = useAppStore(
    (s) =>
      Object.values(s.unifiedTabsByWorktree)
        .flat()
        .find((tab) => tab.id === tabId)?.agentSessionAgent
  )
  const requestState = useAgentHubRequests()
  const attention = useAgentHubOrbAttention()
  const requests = agentHubInboxRequests(requestState).filter((item) =>
    agentHubCurrentOrbRequest(item, { host: 'local', sessionId })
  )
  const currentRequest = nativeRequestPending ? undefined : requests[0]
  const quick = useAgentHubOrbQuickWrite({
    tabId,
    state,
    prepareDictation: voice.prepareDictation,
    currentRequest,
    onShowChat: showConversation
  })
  const hasRequest = nativeRequestPending || requests.length > 0
  const requestVisible = nativeRequestVisible || (requests.length > 0 && !quick.requestDismissed)
  const quickDictating = dictating || quick.dictation.active
  const visual = agentHubOrbPresentation(
    state,
    voice,
    hasRequest,
    quickDictating ? dictationState : null,
    currentRequest?.request.kind === 'gate' || currentRequest?.request.kind === 'consent',
    attention
  )
  const requestCard = currentRequest ? (
    <AgentHubRequestCard
      key={currentRequest.request.requestId}
      item={currentRequest}
      presentation={requestPresentationOf(currentRequest.host, currentRequest.request)}
      onDismiss={showChat ? undefined : quick.later}
      dismissLabel={
        currentRequest.request.kind === 'notify'
          ? undefined
          : translate('agentHub.orb.answerLater', 'Answer later')
      }
    />
  ) : null
  const settingsLabel = translate('auto.agentHub.orb.settings', 'Orb settings')
  const dictate = () => {
    void voice.prepareDictation().then((ready) => {
      if (!ready) {
        return
      }
      useAgentHubOrbPanel.setState({ presentation: 'chat', compact: false })
      requestAnimationFrame(toggleAgentHubOrb)
    })
  }
  const agent = conversation?.agent ?? tabAgent
  const sphereAction = agentHubOrbSphereAction({ liveActive: live, dictating: quickDictating })
  const sphereLabels = {
    none: visual.label,
    'finish-dictation': translate('auto.agentHub.orb.finishDictation', 'Finish and send dictation'),
    'quick-input': translate('agentHub.orb.quickInput', 'Message Orb')
  }
  const stopDictation = (): void => {
    if (quick.dictation.active) {
      quick.dictation.stop()
    } else {
      dispatchDictationControl('stop')
    }
  }
  const onSphereClick = () => {
    cancelAgentHubOrbLaunch(sessionId, tabId)
    if (sphereAction === 'finish-dictation') {
      stopDictation()
    } else if (sphereAction === 'quick-input') {
      quick.onSphereClick()
    }
  }
  const canHold = sphereAction === 'quick-input' && !busy && voice.connection !== 'stopping'
  return (
    <section
      aria-label={translate('auto.agentHub.orb.title', 'Orb')}
      className="flex h-[min(640px,calc(100vh-96px))] min-h-0 flex-col"
    >
      {showChat || !chatVisible ? (
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
          onSleep={sleep}
          onClose={closeAgentHubOrbPanel}
          requestAction={
            showChat ? (
              <AgentHubOrbRequestModal
                pending={hasRequest}
                requestKey={`${sessionId}:${nativeRequestPending ? (nativeRequestId ?? 'native') : (currentRequest?.request.requestId ?? 'none')}`}
              >
                {requestCard}
              </AgentHubOrbRequestModal>
            ) : undefined
          }
        />
      ) : null}
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
      <AgentHubOrbFollowNotices onOpenTarget={openFollowTarget} />
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
      <div
        ref={setAgentHubOrbDestination}
        data-agent-hub-orb-chat-tab-id={tabId}
        className={showChat ? 'relative min-h-0 flex-1 overflow-hidden' : 'hidden'}
      />
      {!showChat ? (
        <AgentHubOrbStage
          {...visual}
          caption={live ? voice.caption : (quick.reply ?? undefined)}
          captionDurationMs={live ? undefined : AGENT_HUB_ORB_REPLY_MS}
          captionAction={
            live ? undefined : (
              <Button
                type="button"
                variant="link"
                size="xs"
                className="ml-auto shrink-0"
                onClick={quick.showChat}
              >
                {translate('agentHub.orb.openChat', 'Open chat')}
                <ChevronRight aria-hidden />
              </Button>
            )
          }
          inputMuted={live && voice.input === 'muted'}
          outputMuted={live && voice.outputMuted}
          inputSpeaking={voice.inputSpeaking}
          embedded={showChat}
          live={live}
          compact={compact}
          visible={visible && chatVisible}
          requestVisible={requestVisible}
          sphereLabel={sphereLabels[sphereAction]}
          onSphereClick={onSphereClick}
          onSphereDoubleClick={showConversation}
          onSphereHoldStart={canHold ? quick.onSphereHoldStart : undefined}
          onSphereHoldEnd={quick.dictation.stop}
          quickInput={
            live ? null : (
              <AgentHubOrbQuickInput
                open={quick.open}
                ready={quick.ready && !busy}
                inputRef={quick.inputRef}
                value={quick.draft}
                listening={quick.dictation.active}
                onChange={quick.setDraft}
                onInput={quick.dictation.onInput}
                onKeyDown={quick.dictation.onKeyDown}
                onSubmit={quick.submit}
                onDictate={quick.dictation.start}
                onStopDictation={quick.dictation.stop}
                onOpenChat={quick.showChat}
              />
            )
          }
          notice={
            voice.reason ??
            (agent === 'codex' && voice.capability === 'unsupported'
              ? translate(
                  'auto.agentHub.orb.voiceUnavailable',
                  'Live voice is unavailable on this host.'
                )
              : undefined)
          }
          request={requestCard}
          sphereControls={live ? <AgentHubOrbLiveControls voice={voice} /> : null}
          controls={
            <AgentHubOrbControls
              voice={voice}
              codex={agent === 'codex'}
              orbView={!showChat}
              compact={compact}
              busy={busy}
              dictating={quickDictating}
              onShowChat={showConversation}
              onShowOrb={() => {
                cancelAgentHubOrbLaunch(sessionId, tabId)
                useAgentHubOrbPanel.setState({ presentation: 'orb', compact: false })
              }}
              onCompact={() =>
                useAgentHubOrbPanel.setState({
                  compact: !compact,
                  ...(compact ? { presentation: 'orb' } : {})
                })
              }
              onModeChange={() => cancelAgentHubOrbLaunch(sessionId, tabId)}
              onText={() => {
                finishAgentHubOrbDictationForText(tabId)
                void voice
                  .switchToText()
                  .then(() =>
                    useAgentHubOrbPanel.setState({ presentation: 'chat', compact: false })
                  )
              }}
              onDictate={dictate}
              onStopDictation={stopDictation}
              onCancelDictation={cancelDictation}
              onHistory={() => setView('history')}
              onSettings={() => setView('settings')}
              onNew={() => {
                void reopen()
              }}
              onSleep={sleep}
              onClose={closeAgentHubOrbPanel}
            />
          }
        />
      ) : null}
    </section>
  )
}

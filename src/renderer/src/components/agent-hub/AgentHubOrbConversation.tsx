import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { structuredAgentLabel } from '@/lib/agent-session/launch/structured-agent-session-launch-label'
import { useAppStore } from '@/store'
import {
  useAgentHubOrbPanel,
  closeAgentHubOrbPanel,
  cancelAgentHubOrbLaunch,
  setAgentHubOrbDestination
} from './agent-hub-orb-panel-store'
import { useAgentHubOrbConversations } from './agent-hub-orb-conversations'
import { AgentHubOrbSecondaryViews } from './AgentHubOrbSecondaryViews'
import { AgentHubOrbMiniWindow } from './AgentHubOrbMiniWindow'
import { cancelDictation } from './agent-hub-dictation-cancel'
import { useAgentHubDictationSession } from './agent-hub-dictation-origin'
import { isDictationRunning } from './agent-hub-mirror-mic-state'
import {
  agentHubInboxRequests,
  agentHubOrbMemoryRequests,
  useAgentHubRequests
} from './agent-hub-requests-store'
import { AgentHubOrbMemoryCard } from './AgentHubOrbMemoryCard'
import type { AgentHubOrbState } from './agent-hub-orb-state'
import { agentHubCurrentOrbRequest } from './agent-hub-orb-request-owner'
import { AgentHubOrbStage } from './AgentHubOrbStage'
import { agentHubOrbSphereAction } from './agent-hub-orb-sphere-action'
import { AgentHubOrbHoverControls } from './AgentHubOrbHoverControls'
import { agentHubOrbVoiceNotice } from './agent-hub-orb-voice-state'
import { AgentHubOrbConversationHeader } from './AgentHubOrbConversationHeader'
import { agentHubOrbPresentation } from './agent-hub-orb-presentation'
import { useAgentHubOrbAttention } from './agent-hub-orb-attention'
import type { AgentHubOrbVoiceValue } from './use-agent-hub-orb-voice'
import { dispatchDictationControl } from '../dictation/dictation-control-events'
import { AgentHubRequestCard } from './AgentHubRequestCard'
import { AgentHubOrbRequestModal } from './AgentHubOrbRequestModal'
import { AgentHubOrbLiveControls } from './AgentHubOrbLiveControls'
import { AgentHubOrbQuickInput } from './AgentHubOrbQuickInput'
import { AgentHubOrbThinking } from './AgentHubOrbSpeechBubble'
import type { AgentHubRequestBase } from '../../../../shared/agent-hub-requests'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'
import { AgentHubOrbFollowNotices } from './AgentHubOrbFollowNotices'
import { useAgentHubOrbAwarenessDelivery } from './use-agent-hub-orb-awareness-delivery'
import { useAgentHubOrbQuickWrite } from './use-agent-hub-orb-quick-write'
import { useAgentHubOrbReopen } from './use-agent-hub-orb-reopen'
import { openAgentHubMirrors } from './agent-hub-mirror-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { sleepAgentHubOrb } from './agent-hub-orb-sleep'
import { useAgentHubOrbName } from './use-agent-hub-orb-identity'
import { setAgentHubOrbPinned } from './agent-hub-orb-dock-pin'
import { normalizeAgentHubPlacement } from '../../../../shared/agent-hub-settings'

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
  const pinned = useAgentHubOrbPanel((s) => s.pinned)
  const canPin = useAppStore(
    (s) => normalizeAgentHubPlacement(s.settings?.agentHubPlacement) === 'dock'
  )
  const nativeRequestPending = useAgentHubOrbPanel((s) => s.nativeRequestPending)
  const nativeRequestId = useAgentHubOrbPanel((s) => s.nativeRequestId)
  const nativeRequestVisible = useAgentHubOrbPanel(
    (s) => s.nativeRequestVisible || s.nativeRequestPending
  )
  const showChat = chatVisible && presentation === 'chat' && !compact
  const showMini = chatVisible && presentation === 'mini' && !compact
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
    // History and settings open in the panel, so the floating window hands over to it too.
    useAgentHubOrbPanel.setState({
      chatVisible: view === 'chat',
      presentation: 'chat',
      compact: false
    })
  }
  const present = (presentation: 'chat' | 'mini' | 'orb'): void => {
    cancelAgentHubOrbLaunch(sessionId, tabId)
    useAgentHubOrbPanel.setState({ presentation, compact: false })
  }
  const showMiniWindow = (): void => present('mini')
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
  const startNew = (): void => void reopen()
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
  const memoryPending =
    agentHubOrbMemoryRequests(requestState, { host: 'local', sessionId }).length > 0
  const memoryCard = <AgentHubOrbMemoryCard host="local" sessionId={sessionId} />
  const quick = useAgentHubOrbQuickWrite({
    tabId,
    state,
    prepareDictation: voice.prepareDictation,
    currentRequest,
    onShowChat: showMiniWindow
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
      onDismiss={showChat || showMini ? undefined : quick.later}
      dismissLabel={
        currentRequest.request.kind === 'notify'
          ? undefined
          : translate('agentHub.orb.answerLater', 'Answer later')
      }
    />
  ) : null
  const orbName = useAgentHubOrbName()
  const agent = conversation?.agent ?? tabAgent
  const sphereAction = agentHubOrbSphereAction({ liveActive: live, dictating: quickDictating })
  const sphereLabels = {
    none: visual.label,
    'finish-dictation': translate('auto.agentHub.orb.finishDictation', 'Finish and send dictation'),
    'quick-input': translate('agentHub.orb.quickInputNamed', 'Message {{name}}', { name: orbName })
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
  const agentLabel = agent
    ? `${structuredAgentLabel(agent)} · ${conversation?.model ?? translate('auto.agentHub.orb.agentDefault', 'Agent default')}`
    : null
  // Why: the retained chat follows this div into whichever surface shows it.
  const chatHost = (
    <div
      ref={setAgentHubOrbDestination}
      data-agent-hub-orb-chat-tab-id={tabId}
      className={showChat || showMini ? 'relative min-h-0 flex-1 overflow-hidden' : 'hidden'}
    />
  )
  return (
    <section aria-label={orbName} className="flex h-[min(640px,calc(100vh-96px))] min-h-0 flex-col">
      {showChat || !chatVisible ? (
        <AgentHubOrbConversationHeader
          history={history}
          settingsView={showSettings}
          chatVisible={chatVisible}
          busy={busy}
          agentLabel={agentLabel}
          onBack={() => setView('chat')}
          onHistory={() => setView('history')}
          onSettings={() => setView('settings')}
          onNew={startNew}
          onMiniWindow={showMiniWindow}
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
      <AgentHubOrbSecondaryViews
        sessionId={sessionId}
        busy={busy}
        error={error}
        failure={failure}
        history={history}
        settingsView={showSettings}
        conversations={conversations}
        settings={settings}
        updateSettings={updateSettings}
        reopen={reopen}
        refresh={refresh}
      />
      <AgentHubOrbFollowNotices onOpenTarget={openFollowTarget} />
      {showChat ? memoryCard : null}
      {showMini ? (
        <AgentHubOrbMiniWindow
          sessionId={sessionId}
          sphere={{
            ...visual,
            inputMuted: live && voice.input === 'muted',
            outputMuted: live && voice.outputMuted,
            inputSpeaking: voice.inputSpeaking
          }}
          agentLabel={agentLabel}
          busy={busy}
          request={requestCard}
          requestVisible={hasRequest}
          memory={memoryCard}
          onShowChat={() => present('chat')}
          onNew={startNew}
          onHistory={() => setView('history')}
          onMinimize={() => present('orb')}
          onSleep={sleep}
          onHide={closeAgentHubOrbPanel}
        >
          {chatHost}
        </AgentHubOrbMiniWindow>
      ) : (
        chatHost
      )}
      {!showChat && !showMini ? (
        <AgentHubOrbStage
          {...visual}
          caption={live ? voice.caption : (quick.reply ?? undefined)}
          captionKey={live ? undefined : quick.replyKey}
          captionDurationMs={live ? undefined : AGENT_HUB_ORB_REPLY_MS}
          captionPrompt={live ? undefined : quick.ask?.text}
          captionStatus={
            live || !quick.ask || quick.ask.status === 'answered' ? undefined : quick.ask.status ===
              'failed' ? (
              <p className="text-muted-foreground">
                {translate('agentHub.orb.captionNoReply', 'No reply came back.')}
              </p>
            ) : (
              <AgentHubOrbThinking command={state.kind === 'working' ? state.command : undefined} />
            )
          }
          captionAction={
            live || (!quick.reply && !quick.ask) ? undefined : (
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
          captionHint={
            memoryPending && !live ? (
              <p
                className={
                  quick.reply
                    ? 'mt-2 text-xs text-muted-foreground'
                    : 'text-xs text-muted-foreground'
                }
              >
                {translate('agentHub.orb.memoryProposal.hint', 'Memory suggestion')}
                {' · '}
                <button
                  type="button"
                  className="cursor-pointer underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  onClick={showMiniWindow}
                >
                  {translate('agentHub.orb.memoryProposal.openConversation', 'Open conversation')}
                </button>
              </p>
            ) : undefined
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
          onSphereDoubleClick={showMiniWindow}
          onSphereHoldStart={canHold ? quick.onSphereHoldStart : undefined}
          onSphereHoldEnd={quick.dictation.stop}
          quickInput={
            live ? null : (
              <AgentHubOrbQuickInput
                open={quick.open}
                ready={quick.ready && !busy}
                inputRef={quick.inputRef}
                value={quick.draft}
                dictation={quick.dictation}
                mention={quick.mention}
                onChange={quick.setDraft}
                onInput={quick.dictation.onInput}
                onKeyDown={quick.dictation.onKeyDown}
                onSubmit={quick.submit}
                onDictate={quick.dictation.start}
                onStopDictation={quick.dictation.stop}
                onOpenChat={quick.showChat}
                onClose={quick.close}
              />
            )
          }
          notice={agentHubOrbVoiceNotice(voice)}
          request={requestCard}
          sphereControls={
            live ? (
              <AgentHubOrbLiveControls voice={voice} />
            ) : (
              <AgentHubOrbHoverControls
                voice={voice}
                codex={agent === 'codex'}
                compact={compact}
                busy={busy}
                dictating={quickDictating}
                pinned={pinned}
                canPin={canPin}
                onMiniWindow={showMiniWindow}
                onExpand={() =>
                  useAgentHubOrbPanel.setState({ compact: false, presentation: 'orb' })
                }
                onLive={() => {
                  cancelAgentHubOrbLaunch(sessionId, tabId)
                  void voice.startLive()
                }}
                onSleep={sleep}
                onCancelDictation={cancelDictation}
                onTogglePin={() => setAgentHubOrbPinned(!pinned)}
              />
            )
          }
        />
      ) : null}
    </section>
  )
}

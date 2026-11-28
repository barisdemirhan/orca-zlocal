import { useCallback, useState } from 'react'
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
import { AgentHubOrbStageControls, AgentHubOrbStageQuickInput } from './AgentHubOrbStageControls'
import { agentHubOrbVoiceNotice } from './agent-hub-orb-voice-state'
import { AgentHubOrbWindowHeader } from './AgentHubOrbWindowHeader'
import { useAgentHubOrbHeaderActions } from './use-agent-hub-orb-header-actions'
import { agentHubOrbPresentation } from './agent-hub-orb-presentation'
import { useAgentHubOrbAttention } from './agent-hub-orb-attention'
import type { AgentHubOrbVoiceValue } from './use-agent-hub-orb-voice'
import { useAgentHubOrbSphereClick } from './use-agent-hub-orb-sphere-click'
import { AgentHubOrbRequestCard } from './AgentHubOrbStageControls'
import { AgentHubOrbRequestModal } from './AgentHubOrbRequestModal'
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
import { useAgentHubOrbBotBubble } from './use-agent-hub-orb-bot-bubble'
import { AgentHubOrbBotAskCard } from './AgentHubOrbBotBubble'
import { agentHubOrbCaptionSlots } from './agent-hub-orb-caption-slots'
import { normalizeAgentHubPlacement } from '../../../../shared/agent-hub-settings'
import { AgentHubOrbWindow } from './AgentHubOrbWindow'
import { useAgentHubOrbChatStrip } from './agent-hub-orb-chat-strip-store'
import { agentHubOrbWindowStateLabel } from './agent-hub-orb-window-state'
import { AgentHubOrbSideAskCard } from './AgentHubOrbSideAskCard'
import { useAgentHubOrbBot } from './use-agent-hub-orb-bot'
import { useAgentHubOrbClearHome } from './use-agent-hub-orb-clear-home'
import { useAgentHubOrbSideAsk } from './use-agent-hub-orb-side-ask'

const sleep = (): void => void sleepAgentHubOrb()

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
  const orbBot = useAgentHubOrbBot()
  const windowTab = useAgentHubOrbChatStrip((s) => s.windowTab)
  const sideAsk = useAgentHubOrbSideAsk(sessionId)
  const sideAskId = sideAsk?.id ?? null
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
  const startNew = useCallback((): void => void reopen(), [reopen])
  const clearHome = useAgentHubOrbClearHome(startNew)
  const headerActions = useAgentHubOrbHeaderActions({
    bot: orbBot ?? null,
    clearHome,
    fallbackNew: startNew
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
  const replyPending = quick.ask?.status === 'sent' || quick.ask?.status === 'working'
  const botBubble = useAgentHubOrbBotBubble({
    busy:
      live ||
      quick.open ||
      quickDictating ||
      hasRequest ||
      requestVisible ||
      showChat ||
      showMini ||
      compact ||
      !chatVisible,
    idle: state.kind === 'idle',
    replyKey: quick.replyKey,
    replyPending
  })
  // Why: a waiting bot ask only colours the sphere while nothing livelier is going on.
  const askAttention =
    (botBubble.attention || sideAskId !== null) &&
    !live &&
    !quickDictating &&
    voice.connection !== 'error' &&
    (state.kind === 'idle' || state.kind === 'off' || state.kind === 'done')
  const askCardVisible = botBubble.asking && !hasRequest
  const visual = agentHubOrbPresentation(
    state,
    voice,
    hasRequest || askAttention,
    quickDictating ? dictationState : null,
    currentRequest?.request.kind === 'gate' || currentRequest?.request.kind === 'consent',
    attention
  )
  const sphereProps = {
    ...visual,
    inputMuted: live && voice.input === 'muted',
    outputMuted: live && voice.outputMuted,
    inputSpeaking: voice.inputSpeaking
  }
  const requestCard = currentRequest ? (
    <AgentHubOrbRequestCard
      key={currentRequest.request.requestId}
      item={currentRequest}
      presentation={requestPresentationOf(currentRequest.host, currentRequest.request)}
      onLater={showChat || showMini ? undefined : quick.later}
    />
  ) : null
  const askCard =
    askCardVisible && botBubble.askEntry ? (
      <AgentHubOrbBotAskCard entry={botBubble.askEntry} onLater={botBubble.later} />
    ) : null
  const sideAskCard =
    askAttention && sideAsk && !hasRequest && !askCardVisible ? (
      <AgentHubOrbSideAskCard chat={sideAsk} />
    ) : null
  const captionSlots = agentHubOrbCaptionSlots({
    live,
    liveCaption: voice.caption,
    bubble: botBubble.view,
    hasAsks: botBubble.hasAsks,
    onAnswer: botBubble.openAsk,
    onDismiss: botBubble.dismiss,
    reply: quick.reply,
    replyKey: quick.replyKey,
    ask: quick.ask,
    state,
    memoryPending,
    onShowChat: quick.showChat,
    onOpenConversation: showMiniWindow
  })
  const orbName = useAgentHubOrbName()
  const agent = conversation?.agent ?? tabAgent
  const sphereAction = agentHubOrbSphereAction({ liveActive: live, dictating: quickDictating })
  const sphereLabels = {
    none: visual.label,
    'finish-dictation': translate('auto.agentHub.orb.finishDictation', 'Finish and send dictation'),
    'quick-input': translate('agentHub.orb.quickInputNamed', 'Message {{name}}', { name: orbName })
  }
  const onSphereClick = useAgentHubOrbSphereClick({
    sessionId,
    tabId,
    sideAskId,
    action: sphereAction,
    hasRequest,
    botBubble,
    quick
  })
  const canHold = sphereAction === 'quick-input' && !busy && voice.connection !== 'stopping'
  const agentLabel = agent
    ? `${structuredAgentLabel(agent)} · ${conversation?.model ?? translate('auto.agentHub.orb.agentDefault', 'Agent default')}`
    : null
  // Why: the retained chat follows this div into whichever surface shows it.
  const chatHost = (
    <div
      ref={setAgentHubOrbDestination}
      data-agent-hub-orb-chat-tab-id={tabId}
      className={
        (showChat || showMini) && (!orbBot || windowTab === 'chat')
          ? 'relative min-h-0 flex-1 overflow-hidden'
          : 'hidden'
      }
    />
  )
  return (
    <section aria-label={orbName} className="flex h-[min(640px,calc(100vh-96px))] min-h-0 flex-col">
      {showChat || !chatVisible ? (
        <AgentHubOrbWindowHeader
          bot={orbBot}
          sphere={sphereProps}
          name={orbName}
          actions={headerActions}
          onClearHome={clearHome}
          history={history}
          settingsView={showSettings}
          chatVisible={chatVisible}
          busy={busy}
          agentLabel={agentLabel}
          stateLabel={orbBot ? agentHubOrbWindowStateLabel(orbBot, state, askAttention) : undefined}
          onBack={() => setView('chat')}
          onHistory={() => setView('history')}
          onSettings={() => setView('settings')}
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
          voice={voice}
          onClearHome={clearHome}
          sphere={sphereProps}
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
      ) : orbBot && showChat ? (
        <AgentHubOrbWindow
          bot={orbBot}
          sessionId={sessionId}
          homeTitle={translate('agentHub.orb.strip.home', 'Home chat')}
          voice={voice}
          chatWaiting={hasRequest || askCardVisible}
          onClearHome={clearHome}
        >
          {chatHost}
        </AgentHubOrbWindow>
      ) : (
        chatHost
      )}
      {!showChat && !showMini ? (
        <AgentHubOrbStage
          {...visual}
          badge={botBubble.count}
          orbit={botBubble.orbit}
          ring={botBubble.ring}
          {...captionSlots}
          inputMuted={live && voice.input === 'muted'}
          outputMuted={live && voice.outputMuted}
          inputSpeaking={voice.inputSpeaking}
          embedded={showChat}
          live={live}
          compact={compact}
          visible={visible && chatVisible}
          requestVisible={requestVisible || askCardVisible || sideAskCard !== null}
          sphereLabel={sphereLabels[sphereAction]}
          onSphereClick={onSphereClick}
          onSphereDoubleClick={showMiniWindow}
          onSphereHoldStart={canHold ? quick.onSphereHoldStart : undefined}
          onSphereHoldEnd={quick.dictation.stop}
          quickInput={live ? null : <AgentHubOrbStageQuickInput quick={quick} busy={busy} />}
          notice={agentHubOrbVoiceNotice(voice)}
          request={requestCard ?? askCard ?? sideAskCard}
          sphereControls={
            <AgentHubOrbStageControls
              voice={voice}
              live={live}
              codex={agent === 'codex'}
              compact={compact}
              busy={busy}
              dictating={quickDictating}
              pinned={pinned}
              canPin={canPin}
              onMiniWindow={showMiniWindow}
              onLive={() => {
                cancelAgentHubOrbLaunch(sessionId, tabId)
                void voice.startLive()
              }}
              onSleep={sleep}
            />
          }
        />
      ) : null}
    </section>
  )
}

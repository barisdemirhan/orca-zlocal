import { translate } from '@/i18n/i18n'
import { AgentHubRequestCard } from './AgentHubRequestCard'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'
import type { AgentHubInboxRequest } from './agent-hub-requests-store'
import { cancelDictation } from './agent-hub-dictation-cancel'
import { setAgentHubOrbPinned } from './agent-hub-orb-dock-pin'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { AgentHubOrbHoverControls } from './AgentHubOrbHoverControls'
import { AgentHubOrbLiveControls } from './AgentHubOrbLiveControls'
import { AgentHubOrbQuickInput } from './AgentHubOrbQuickInput'
import type { useAgentHubOrbQuickWrite } from './use-agent-hub-orb-quick-write'
import type { AgentHubOrbVoiceValue } from './use-agent-hub-orb-voice'

export function AgentHubOrbStageQuickInput({
  quick,
  busy
}: {
  quick: ReturnType<typeof useAgentHubOrbQuickWrite>
  busy: boolean
}): React.JSX.Element {
  return (
    <AgentHubOrbQuickInput
      open={quick.open}
      ready={quick.ready && !busy}
      inputRef={quick.inputRef}
      value={quick.draft}
      dictation={quick.dictation}
      mention={quick.mention}
      quickTarget={quick.quickTarget}
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

/** The controls that appear by the sphere: Live's own while a call runs, the hover set otherwise. */
export function AgentHubOrbStageControls({
  voice,
  live,
  codex,
  compact,
  busy,
  dictating,
  pinned,
  canPin,
  onMiniWindow,
  onLive,
  onSleep
}: {
  voice: AgentHubOrbVoiceValue
  live: boolean
  codex: boolean
  compact: boolean
  busy: boolean
  dictating: boolean
  pinned: boolean
  canPin: boolean
  onMiniWindow: () => void
  onLive: () => void
  onSleep: () => void
}): React.JSX.Element {
  return live ? (
    <AgentHubOrbLiveControls voice={voice} />
  ) : (
    <AgentHubOrbHoverControls
      voice={voice}
      codex={codex}
      compact={compact}
      busy={busy}
      dictating={dictating}
      pinned={pinned}
      canPin={canPin}
      onMiniWindow={onMiniWindow}
      onExpand={() => useAgentHubOrbPanel.setState({ compact: false, presentation: 'orb' })}
      onLive={onLive}
      onSleep={onSleep}
      onCancelDictation={cancelDictation}
      onTogglePin={() => setAgentHubOrbPinned(!pinned)}
    />
  )
}

export function AgentHubOrbRequestCard({
  item,
  presentation,
  onLater
}: {
  item: AgentHubInboxRequest
  presentation: AgentHubRequestPresentation
  onLater: (() => void) | undefined
}): React.JSX.Element {
  return (
    <AgentHubRequestCard
      key={item.request.requestId}
      item={item}
      presentation={presentation}
      onDismiss={onLater}
      dismissLabel={
        item.request.kind === 'notify'
          ? undefined
          : translate('agentHub.orb.answerLater', 'Answer later')
      }
    />
  )
}

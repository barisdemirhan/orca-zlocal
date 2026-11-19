import { AppWindow, AudioLines, Maximize2, MicOff, Moon, Pin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { AgentHubActionTooltip } from './AgentHubShortcut'
import { AgentHubOrbHeaderAction } from './AgentHubOrbConversationHeader'
import type { AgentHubOrbVoiceValue } from './use-agent-hub-orb-voice'
import { useAgentHubOrbName } from './use-agent-hub-orb-identity'

/** The pill at the top of the floating sphere: mini window, Live (Codex), dock pin, Sleep, and Expand while compact. */
export function AgentHubOrbHoverControls({
  voice,
  codex,
  compact,
  busy,
  dictating,
  pinned,
  canPin,
  onMiniWindow,
  onExpand,
  onLive,
  onSleep,
  onCancelDictation,
  onTogglePin
}: {
  voice: Pick<AgentHubOrbVoiceValue, 'capability' | 'canStart' | 'connection' | 'reason'>
  codex: boolean
  compact: boolean
  busy: boolean
  dictating: boolean
  pinned: boolean
  canPin: boolean
  onMiniWindow: () => void
  onExpand: () => void
  onLive: () => void
  onSleep: () => void
  onCancelDictation: () => void
  onTogglePin: () => void
}): React.JSX.Element {
  const name = useAgentHubOrbName()
  const unsupported = voice.capability === 'unsupported'
  const liveLabel = translate('auto.agentHub.orb.startLiveVoice', 'Start live voice')
  const liveTooltip = unsupported
    ? (voice.reason ??
      translate('auto.agentHub.orb.voiceUnavailable', 'Live voice is unavailable on this host.'))
    : liveLabel
  return (
    <div className="flex items-center gap-1">
      {compact && !pinned ? (
        <AgentHubOrbHeaderAction
          label={translate('auto.agentHub.orb.expand', 'Expand Orb')}
          onClick={onExpand}
        >
          <Maximize2 />
        </AgentHubOrbHeaderAction>
      ) : (
        <AgentHubOrbHeaderAction
          label={translate('agentHub.orb.miniWindow', 'Floating window')}
          onClick={onMiniWindow}
        >
          <AppWindow />
        </AgentHubOrbHeaderAction>
      )}
      {codex && !compact ? (
        <AgentHubActionTooltip label={liveTooltip} actionId="agentHub.toggleOrb">
          {/* Why: a disabled button gets no pointer events, so the tooltip hangs on its wrapper. */}
          <span className="inline-flex">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={liveLabel}
              disabled={busy || dictating || unsupported || !voice.canStart}
              onClick={onLive}
            >
              <AudioLines />
            </Button>
          </span>
        </AgentHubActionTooltip>
      ) : null}
      {dictating ? (
        <AgentHubOrbHeaderAction
          label={translate('auto.agentHub.orb.cancelDictation', 'Cancel dictation')}
          onClick={onCancelDictation}
        >
          <MicOff />
        </AgentHubOrbHeaderAction>
      ) : null}
      {canPin || pinned ? (
        <AgentHubOrbHeaderAction
          label={
            pinned
              ? translate('agentHub.orb.unpinFromDock', 'Release from the dock')
              : translate('agentHub.orb.pinToDock', 'Pin beside the dock')
          }
          pressed={pinned}
          onClick={onTogglePin}
        >
          <Pin />
        </AgentHubOrbHeaderAction>
      ) : null}
      <AgentHubOrbHeaderAction
        label={translate('agentHub.orb.sleepNamed', 'Put {{name}} to sleep', { name })}
        disabled={busy}
        onClick={onSleep}
      >
        <Moon />
      </AgentHubOrbHeaderAction>
    </div>
  )
}

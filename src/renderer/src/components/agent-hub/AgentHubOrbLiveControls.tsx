import { Mic, MicOff, Square, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { AgentHubActionTooltip } from './AgentHubShortcut'
import type { AgentHubOrbVoiceValue } from './use-agent-hub-orb-voice'

export function AgentHubOrbLiveControls({
  voice,
  onStop
}: {
  voice: Pick<
    AgentHubOrbVoiceValue,
    'connection' | 'input' | 'outputMuted' | 'muteInput' | 'muteOutput' | 'stopLive'
  >
  onStop?: () => void
}): React.JSX.Element {
  const controls = [
    {
      id: 'stop',
      actionId: 'agentHub.toggleOrb',
      label: translate('auto.agentHub.orb.endLiveVoice', 'End live voice'),
      icon: Square,
      disabled: voice.connection === 'stopping',
      run: onStop ?? (() => void voice.stopLive())
    },
    {
      id: 'speaker',
      actionId: 'agentHub.orb.toggleSpeaker',
      label: translate('agentHub.orb.muteSpeaker', 'Mute Orb'),
      tooltip: voice.outputMuted
        ? translate('agentHub.orb.unmuteSpeaker', 'Unmute Orb')
        : translate('agentHub.orb.muteSpeaker', 'Mute Orb'),
      icon: voice.outputMuted ? VolumeX : Volume2,
      disabled: voice.connection !== 'live',
      pressed: voice.outputMuted,
      run: () => voice.muteOutput(!voice.outputMuted)
    },
    {
      id: 'microphone',
      actionId: 'agentHub.orb.toggleMicrophone',
      label: translate('auto.agentHub.orb.muteMicrophone', 'Mute microphone'),
      tooltip:
        voice.input === 'muted'
          ? translate('auto.agentHub.orb.unmuteMicrophone', 'Unmute microphone')
          : translate('auto.agentHub.orb.muteMicrophone', 'Mute microphone'),
      icon: voice.input === 'muted' ? MicOff : Mic,
      disabled: voice.connection !== 'live',
      pressed: voice.input === 'muted',
      run: () => voice.muteInput(voice.input !== 'muted')
    }
  ]
  return (
    <div
      data-agent-hub-orb-live-controls
      data-agent-hub-orb-interactive
      className="flex items-center gap-1"
    >
      {controls.map(({ id, actionId, label, tooltip, icon: Icon, disabled, pressed, run }) => (
        <AgentHubActionTooltip key={id} label={tooltip ?? label} actionId={actionId}>
          <Button
            type="button"
            variant={pressed ? 'secondary' : 'ghost'}
            size="icon-sm"
            aria-label={label}
            aria-pressed={pressed}
            disabled={disabled}
            onClick={run}
          >
            <Icon />
          </Button>
        </AgentHubActionTooltip>
      ))}
    </div>
  )
}

import {
  AudioLines,
  Circle,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  MoreHorizontal,
  Square,
  VolumeX
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import type { AgentHubOrbVoiceValue } from './use-agent-hub-orb-voice'

function OrbControl({
  label,
  children,
  onClick,
  disabled,
  pressed
}: {
  label: string
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  pressed?: boolean
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={pressed}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function AgentHubOrbControls({
  voice,
  codex,
  orbView,
  compact,
  busy,
  dictating,
  onShowChat,
  onShowOrb,
  onCompact,
  onText,
  onDictate,
  onStopDictation,
  onCancelDictation,
  onHistory,
  onSettings,
  onNew,
  onClose
}: {
  voice: AgentHubOrbVoiceValue
  codex: boolean
  orbView: boolean
  compact: boolean
  busy: boolean
  dictating: boolean
  onShowChat: () => void
  onShowOrb: () => void
  onCompact: () => void
  onText: () => void
  onDictate: () => void
  onStopDictation: () => void
  onCancelDictation: () => void
  onHistory: () => void
  onSettings: () => void
  onNew: () => void
  onClose: () => void
}): React.JSX.Element {
  const live =
    voice.connection === 'live' ||
    voice.connection === 'connecting' ||
    voice.connection === 'stopping'
  const starting = voice.capability === 'checking'
  const endLabel = translate('auto.agentHub.orb.endLiveVoice', 'End live voice')
  const startLabel = translate('auto.agentHub.orb.startLiveVoice', 'Start live voice')
  const chatLabel = translate('auto.agentHub.orb.showConversation', 'Show conversation')
  const orbLabel = translate('auto.agentHub.orb.orbView', 'Orb view')
  const muteLabel =
    voice.input === 'muted'
      ? translate('auto.agentHub.orb.unmuteMicrophone', 'Unmute microphone')
      : translate('auto.agentHub.orb.muteMicrophone', 'Mute microphone')
  return (
    <span
      className="contents"
      data-agent-hub-orb-voice={voice.connection}
      data-agent-hub-orb-voice-input={voice.input}
      data-agent-hub-orb-voice-output={voice.output}
    >
      {dictating ? (
        <>
          <OrbControl
            label={translate('auto.agentHub.orb.finishDictation', 'Finish and send dictation')}
            onClick={onStopDictation}
          >
            <Square />
          </OrbControl>
          <OrbControl
            label={translate('auto.agentHub.orb.cancelDictation', 'Cancel dictation')}
            onClick={onCancelDictation}
          >
            <MicOff />
          </OrbControl>
        </>
      ) : live ? (
        <>
          <OrbControl
            label={muteLabel}
            pressed={voice.input === 'muted'}
            disabled={voice.connection !== 'live'}
            onClick={() => voice.muteInput(voice.input !== 'muted')}
          >
            {voice.input === 'muted' ? <MicOff /> : <Mic />}
          </OrbControl>
          <OrbControl
            label={endLabel}
            disabled={voice.connection === 'stopping'}
            onClick={() => {
              void voice.stopLive()
            }}
          >
            <Square />
          </OrbControl>
          {voice.output === 'speaking' ? (
            <OrbControl
              label={translate('auto.agentHub.orb.stopSpeaking', 'Stop speaking')}
              onClick={voice.stopSpeaking}
            >
              <VolumeX />
            </OrbControl>
          ) : null}
        </>
      ) : codex ? (
        <OrbControl
          label={startLabel}
          disabled={busy || starting || !voice.canStart}
          onClick={() => {
            void voice.startLive()
          }}
        >
          <AudioLines />
        </OrbControl>
      ) : null}
      <OrbControl label={orbView ? chatLabel : orbLabel} onClick={orbView ? onShowChat : onShowOrb}>
        {orbView ? <MessageSquare /> : <Circle />}
      </OrbControl>
      {compact ? (
        <OrbControl label={translate('auto.agentHub.orb.expand', 'Expand Orb')} onClick={onCompact}>
          <Maximize2 />
        </OrbControl>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={translate('auto.agentHub.orb.options', 'Orb options')}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="bottom">
          <DropdownMenuItem onSelect={onText}>
            {translate('auto.agentHub.orb.switchToText', 'Switch to text')}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={busy || dictating || voice.connection === 'stopping'}
            onSelect={onDictate}
          >
            {translate('agentHub.card.dictate', 'Dictate')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={busy} onSelect={onHistory}>
            {translate('auto.agentHub.orb.pastConversations', 'Past conversations')}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={busy} onSelect={onNew}>
            {translate('auto.agentHub.orb.newConversation', 'New')}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={busy} onSelect={onSettings}>
            {translate('auto.agentHub.orb.settings', 'Orb settings')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onCompact}>
            <Minimize2 />
            {compact
              ? translate('auto.agentHub.orb.expand', 'Expand Orb')
              : translate('auto.agentHub.orb.minimize', 'Minimize Orb')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onClose}>
            {translate('auto.agentHub.orb.closeOrb', 'Close Orb')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  )
}

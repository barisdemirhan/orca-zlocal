import {
  AudioLines,
  Circle,
  Keyboard,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  MoreHorizontal,
  Square,
  VolumeX,
  X
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
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

type OrbMode = 'live' | 'dictate' | 'text'

function OrbModeItem({
  mode,
  label,
  disabled,
  children
}: {
  mode: OrbMode
  label: string
  disabled?: boolean
  children: ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <ToggleGroupItem value={mode} disabled={disabled} asChild>
        <TooltipTrigger aria-label={label}>{children}</TooltipTrigger>
      </ToggleGroupItem>
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
  const orbLabel = translate('auto.agentHub.orb.orbView', 'Orb view')
  const mode: OrbMode | '' = live
    ? 'live'
    : dictating
      ? 'dictate'
      : !orbView && voice.textMode
        ? 'text'
        : ''
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
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        aria-label={translate('auto.agentHub.orb.mode', 'Orb mode')}
        value={mode}
        onValueChange={(next) => {
          // Pressing the active mode again leaves it: Live ends, dictation sends, text returns to the Orb.
          if (next === 'live') {
            void voice.startLive()
          } else if (next === 'dictate') {
            void (live ? voice.stopLive() : Promise.resolve()).then(onDictate)
          } else if (next === 'text') {
            onText()
          } else if (mode === 'live') {
            void voice.stopLive()
          } else if (mode === 'dictate') {
            onStopDictation()
          } else if (mode === 'text') {
            onShowOrb()
          }
        }}
      >
        {codex ? (
          <OrbModeItem
            mode="live"
            label={live ? endLabel : startLabel}
            disabled={
              voice.connection === 'stopping' ||
              (!live && (busy || dictating || starting || !voice.canStart))
            }
          >
            <AudioLines />
          </OrbModeItem>
        ) : null}
        <OrbModeItem
          mode="dictate"
          label={
            dictating
              ? translate('auto.agentHub.orb.finishDictation', 'Finish and send dictation')
              : translate('agentHub.card.dictate', 'Dictate')
          }
          disabled={!dictating && (busy || voice.connection === 'stopping')}
        >
          <Mic />
        </OrbModeItem>
        <OrbModeItem
          mode="text"
          label={
            mode === 'text'
              ? orbLabel
              : translate('auto.agentHub.orb.switchToText', 'Switch to text')
          }
        >
          <Keyboard />
        </OrbModeItem>
      </ToggleGroup>
      {dictating ? (
        <OrbControl
          label={translate('auto.agentHub.orb.cancelDictation', 'Cancel dictation')}
          onClick={onCancelDictation}
        >
          <MicOff />
        </OrbControl>
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
      ) : null}
      {orbView && live ? (
        <OrbControl
          label={translate('auto.agentHub.orb.showConversation', 'Show conversation')}
          onClick={onShowChat}
        >
          <MessageSquare />
        </OrbControl>
      ) : !orbView && mode !== 'text' ? (
        <OrbControl label={orbLabel} onClick={onShowOrb}>
          <Circle />
        </OrbControl>
      ) : null}
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
          <DropdownMenuItem disabled={busy} onSelect={onHistory}>
            {translate('auto.agentHub.orb.pastConversations', 'Past conversations')}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={busy} onSelect={onNew}>
            {translate('auto.agentHub.orb.newConversation', 'New')}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={busy} onSelect={onSettings}>
            {translate('auto.agentHub.orb.settings', 'Orb settings')}
          </DropdownMenuItem>
          {!compact ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onCompact}>
                <Minimize2 />
                {translate('auto.agentHub.orb.minimize', 'Minimize Orb')}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {orbView ? (
        <OrbControl label={translate('auto.agentHub.orb.closeOrb', 'Close Orb')} onClick={onClose}>
          <X />
        </OrbControl>
      ) : null}
    </span>
  )
}

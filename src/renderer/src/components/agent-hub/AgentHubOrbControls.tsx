import {
  AudioLines,
  Circle,
  Keyboard,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  Moon,
  MoreHorizontal,
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
import { AgentHubActionTooltip, AgentHubShortcut } from './AgentHubShortcut'
import type { AgentHubOrbVoiceValue } from './use-agent-hub-orb-voice'

function OrbControl({
  label,
  actionId,
  children,
  onClick,
  disabled,
  pressed
}: {
  label: string
  actionId?: string
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  pressed?: boolean
}): React.JSX.Element {
  return (
    <AgentHubActionTooltip label={label} actionId={actionId}>
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
    </AgentHubActionTooltip>
  )
}

type OrbMode = 'live' | 'dictate' | 'text'

function OrbModeItem({
  mode,
  label,
  actionId,
  disabled,
  children
}: {
  mode: OrbMode
  label: string
  actionId?: string
  disabled?: boolean
  children: ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <ToggleGroupItem value={mode} disabled={disabled} asChild>
        <TooltipTrigger aria-label={label}>{children}</TooltipTrigger>
      </ToggleGroupItem>
      <TooltipContent>
        <span className="flex items-center gap-2">
          {label}
          <AgentHubShortcut actionId={actionId} />
        </span>
      </TooltipContent>
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
  onModeChange,
  onText,
  onDictate,
  onStopDictation,
  onCancelDictation,
  onHistory,
  onSettings,
  onNew,
  onSleep,
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
  onModeChange: () => void
  onText: () => void
  onDictate: () => void
  onStopDictation: () => void
  onCancelDictation: () => void
  onHistory: () => void
  onSettings: () => void
  onNew: () => void
  onSleep: () => void
  onClose: () => void
}): React.JSX.Element {
  const live =
    voice.connection === 'live' ||
    voice.connection === 'connecting' ||
    voice.connection === 'stopping'
  const starting = voice.capability === 'checking'
  const startLabel = translate('auto.agentHub.orb.startLiveVoice', 'Start live voice')
  const orbLabel = translate('auto.agentHub.orb.orbView', 'Orb view')
  const mode: OrbMode | '' = live
    ? 'live'
    : dictating
      ? 'dictate'
      : !orbView && voice.textMode
        ? 'text'
        : ''
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
        variant="segmented"
        spacing={0.5}
        aria-label={translate('auto.agentHub.orb.mode', 'Orb mode')}
        value={mode}
        onValueChange={(next) => {
          onModeChange()
          // An active Live choice is inert; only its explicit stop control ends the call.
          if (next === 'live') {
            void voice.startLive()
          } else if (next === 'dictate') {
            void (live ? voice.stopLive() : Promise.resolve()).then(onDictate)
          } else if (next === 'text') {
            onText()
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
            label={live ? translate('agentHub.orb.liveActive', 'Live voice on') : startLabel}
            actionId="agentHub.toggleOrb"
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
      ) : null}
      {orbView && live ? (
        <OrbControl
          label={translate('auto.agentHub.orb.showConversation', 'Show conversation')}
          actionId="agentHub.orb.toggleConversation"
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
        <>
          <OrbControl
            label={translate('agentHub.orb.sleep', 'Put Orb to sleep')}
            disabled={busy}
            onClick={onSleep}
          >
            <Moon />
          </OrbControl>
          <OrbControl label={translate('agentHub.orb.hide', 'Hide Orb')} onClick={onClose}>
            <X />
          </OrbControl>
        </>
      ) : null}
    </span>
  )
}

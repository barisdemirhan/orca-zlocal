import { useContext, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { translate } from '@/i18n/i18n'
import { AgentHubOrbComposerStateContext } from './AgentHubOrbComposerState'
import { AgentHubOrbSphere } from './AgentHubOrbSphere'
import { AgentHubOrbLiveControls } from './AgentHubOrbLiveControls'
import { useAgentHubOrbVoiceContext } from './agent-hub-orb-voice-context'
import { agentHubOrbPresentation } from './agent-hub-orb-presentation'
import { useAgentHubOrbAttention } from './agent-hub-orb-attention'
import { useAgentHubOrbComposerDictation } from './agent-hub-orb-composer'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'

export function AgentHubOrbComposerOrb(): React.JSX.Element {
  const { controller, snapshot: voice } = useAgentHubOrbVoiceContext()
  const state = useContext(AgentHubOrbComposerStateContext)
  const chatVisible = useAgentHubOrbPanel(
    (panel) =>
      Boolean(panel.session) && panel.chatVisible && panel.presentation === 'chat' && !panel.compact
  )
  const { phase: dictation } = useAgentHubOrbComposerDictation()
  const attention = useAgentHubOrbAttention()
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const live = ['connecting', 'live', 'stopping'].includes(voice.connection)
  const visual = agentHubOrbPresentation(
    state,
    voice,
    state.kind === 'needsYou',
    dictation === 'finishing' ? 'stopping' : dictation,
    false,
    attention
  )
  const label = live
    ? visual.label
    : translate('auto.agentHub.orb.startLiveVoice', 'Start live voice')
  const reveal = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
    }
    setOpen(true)
  }
  const hide = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
    }
    closeTimer.current = setTimeout(() => {
      if (
        !controlsRef.current?.contains(document.activeElement) &&
        document.activeElement !== triggerRef.current
      ) {
        setOpen(false)
      }
    }, 220)
  }
  useEffect(() => {
    if (state.kind === 'needsYou' || !live) {
      setOpen(false)
    }
  }, [state.kind, live])
  useEffect(
    () => () => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current)
      }
    },
    []
  )
  return (
    <Popover open={open && live && chatVisible} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="icon-sm"
          data-agent-hub-orb-composer-trigger
          aria-label={label}
          disabled={!live && (!controller || !voice.canStart || Boolean(dictation))}
          onPointerEnter={reveal}
          onPointerLeave={hide}
          onFocus={reveal}
          onBlur={hide}
          onKeyDown={(event) => {
            if (live && event.key === 'ArrowUp') {
              event.preventDefault()
              reveal()
              requestAnimationFrame(() => controlsRef.current?.querySelector('button')?.focus())
            }
          }}
          onClick={(event) => {
            event.preventDefault()
            if (!live && event.detail <= 1) {
              void controller?.startLive()
            }
          }}
        >
          <span className="inline-flex size-8">
            <AgentHubOrbSphere
              {...visual}
              inputMuted={live && voice.input === 'muted'}
              outputMuted={live && voice.outputMuted}
              inputSpeaking={voice.inputSpeaking}
            />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        data-agent-hub-orb-composer-controls
        respectReducedMotion
        ref={controlsRef}
        side="top"
        align="end"
        className="w-auto"
        onPointerEnter={reveal}
        onPointerLeave={hide}
        onFocusCapture={reveal}
        onBlurCapture={hide}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {controller ? (
          <AgentHubOrbLiveControls
            voice={{
              ...voice,
              muteInput: controller.muteInput,
              muteOutput: controller.muteOutput,
              stopLive: controller.stopLive
            }}
            onStop={() => void controller.switchToText()}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

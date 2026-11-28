import { useEffect, useState, type RefObject } from 'react'
import { Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { normalizeAgentHubMicMode } from '../../../../shared/agent-hub-settings'
import { readAgentHubDictationCapabilities } from './agent-hub-dictation-capabilities'
import { startAgentHubDictation } from './agent-hub-dictation-improve'
import { dispatchDictationControl } from '../dictation/dictation-control-events'
import { AgentHubDictationPill } from './AgentHubDictationPill'
import { useMirrorShowsDictation } from './agent-hub-mirror-dictation-display'
import { isDictationRunning } from './agent-hub-mirror-mic-state'

/**
 * A reply field's mic: dictates into the field in the same form, and stops that dictation. Hidden
 * while voice is off; inert while a dictation runs somewhere else.
 */
export function HubDictateButton({
  compact = false,
  disabled = false,
  targetInputRef,
  targetTextareaRef
}: {
  compact?: boolean
  disabled?: boolean
  targetInputRef?: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  /** Multiline field of the same row; used when the single-line one is not mounted. */
  targetTextareaRef?: RefObject<HTMLTextAreaElement | null>
}): React.JSX.Element | null {
  const voiceEnabled = useAppStore((s) => s.settings?.voice?.enabled === true)
  const micMode = useAppStore((s) => normalizeAgentHubMicMode(s.settings?.agentHubMicMode))
  const dictationState = useAppStore((s) => s.dictationState)
  const running = isDictationRunning(dictationState)
  const [started, setStarted] = useState(false)
  const listening = started && running
  useMirrorShowsDictation(voiceEnabled && listening)
  useEffect(() => {
    if (!started) {
      return undefined
    }
    return useAppStore.subscribe((state, previous) => {
      if (
        isDictationRunning(previous.dictationState) &&
        !isDictationRunning(state.dictationState)
      ) {
        setStarted(false)
      }
    })
  }, [started])
  if (!voiceEnabled) {
    return null
  }
  if (listening) {
    // Only the active field mounts the meter subscriber.
    return (
      <AgentHubDictationPill
        compact
        disabled={disabled}
        phase={
          dictationState === 'stopping'
            ? 'finishing'
            : dictationState === 'starting'
              ? 'starting'
              : 'listening'
        }
      />
    )
  }
  const improve = micMode === 'improve' && readAgentHubDictationCapabilities().improve
  const label = improve
    ? translate('auto.agentHub.voice.dictateImprove', 'Dictate and improve')
    : translate('agentHub.card.dictate', 'Dictate')
  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? 'icon-xs' : 'icon-sm'}
      tabIndex={-1}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={false}
      aria-disabled={running}
      data-agent-hub-dictate={running ? 'elsewhere' : 'idle'}
      className={compact ? undefined : 'size-7'}
      onClick={(event) => {
        if (running) {
          return
        }
        const input =
          targetInputRef || targetTextareaRef
            ? (targetInputRef?.current ?? targetTextareaRef?.current)
            : event.currentTarget.form?.querySelector('input')
        if (!input || input.disabled) {
          return
        }
        // Dictation inserts into the focused field; a missing target must not reach another pane.
        input.focus()
        if (document.activeElement !== input) {
          return
        }
        setStarted(true)
        // Why toggle: 'start' only leaves idle, and a failed run waits in 'error'.
        if (micMode === 'improve' && readAgentHubDictationCapabilities().improve) {
          startAgentHubDictation(true)
        } else {
          dispatchDictationControl('toggle')
        }
      }}
    >
      <Mic className={compact ? undefined : 'size-4'} />
    </Button>
  )
}

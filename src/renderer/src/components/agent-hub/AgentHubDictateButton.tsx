import { useEffect, useState, type RefObject } from 'react'
import { Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
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
  targetInputRef
}: {
  compact?: boolean
  disabled?: boolean
  targetInputRef?: RefObject<HTMLInputElement | null>
}): React.JSX.Element | null {
  const voiceEnabled = useAppStore((s) => s.settings?.voice?.enabled === true)
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
  const label = translate('agentHub.card.dictate', 'Dictate')
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
        const input = targetInputRef
          ? targetInputRef.current
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
        dispatchDictationControl('toggle')
      }}
    >
      <Mic className={compact ? undefined : 'size-4'} />
    </Button>
  )
}

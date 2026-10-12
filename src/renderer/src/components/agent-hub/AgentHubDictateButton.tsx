import { useEffect, useState } from 'react'
import { Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { dispatchDictationControl } from '../dictation/dictation-control-events'
import { isDictationRunning } from './agent-hub-mirror-mic-state'

/**
 * A reply field's mic: dictates into the field in the same form, and stops that dictation. Hidden
 * while voice is off; inert while a dictation runs somewhere else.
 */
export function HubDictateButton({
  compact = false,
  disabled = false
}: {
  compact?: boolean
  disabled?: boolean
}): React.JSX.Element | null {
  const voiceEnabled = useAppStore((s) => s.settings?.voice?.enabled === true)
  const running = useAppStore((s) => isDictationRunning(s.dictationState))
  const [started, setStarted] = useState(false)
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
  const listening = started && running
  const label = listening
    ? translate('agentHub.mic.stop', 'Stop dictation')
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
      aria-pressed={listening}
      aria-disabled={running && !listening}
      data-agent-hub-dictate={listening ? 'listening' : running ? 'elsewhere' : 'idle'}
      className={compact ? undefined : 'size-7'}
      onClick={(event) => {
        if (listening) {
          dispatchDictationControl('stop')
          return
        }
        if (running) {
          return
        }
        // Why focus first: dictation inserts into whatever field holds focus when it starts.
        event.currentTarget.form?.querySelector('input')?.focus()
        setStarted(true)
        // Why toggle: 'start' only leaves idle, and a failed run waits in 'error'.
        dispatchDictationControl('toggle')
      }}
    >
      <Mic className={compact ? undefined : 'size-4'} />
    </Button>
  )
}

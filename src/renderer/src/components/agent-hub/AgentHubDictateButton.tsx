import { useEffect, useState, type RefObject } from 'react'
import { Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { dispatchDictationControl } from '../dictation/dictation-control-events'
import { useDictationMeter } from '../dictation/dictation-meter-store'
import { DictationGrapes } from '../dictation/DictationGrapes'
import { useMirrorShowsDictation } from './agent-hub-mirror-dictation-display'
import { isDictationRunning } from './agent-hub-mirror-mic-state'

// Why a child: only the field that is listening re-renders on every meter tick.
function HubDictateListening({
  dictationState
}: {
  dictationState: ReturnType<typeof useAppStore.getState>['dictationState']
}): React.JSX.Element {
  const meter = useDictationMeter()
  return (
    <span aria-hidden="true" className="flex size-6 flex-col items-center justify-center">
      <span className="flex h-3 w-6 items-center justify-center">
        <span className="shrink-0 scale-50">
          <DictationGrapes
            level={meter.level}
            active={dictationState !== 'stopping'}
            transitioning={dictationState !== 'listening'}
          />
        </span>
      </span>
      <Square className="size-3 fill-current" />
    </span>
  )
}

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
      {listening ? (
        <HubDictateListening dictationState={dictationState} />
      ) : (
        <Mic className={compact ? undefined : 'size-4'} />
      )}
    </Button>
  )
}

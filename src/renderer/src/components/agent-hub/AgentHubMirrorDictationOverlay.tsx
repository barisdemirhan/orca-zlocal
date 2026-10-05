import { Square } from 'lucide-react'
import { ShortcutKeyCombo } from '@/components/ShortcutKeyCombo'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useShortcutKeyDetails } from '@/hooks/useShortcutLabel'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { dispatchDictationControl } from '../dictation/dictation-control-events'
import { DictationGrapes } from '../dictation/DictationGrapes'
import { useDictationMeter } from '../dictation/dictation-meter-store'
import { useMirrorShowsDictation } from './agent-hub-mirror-dictation-display'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { useAgentHubMirrorMicState } from './use-agent-hub-mirror-mic-state'

type DictationPhase = 'starting' | 'listening' | 'finishing'

/** The app's listening indicator, laid out for the inside of one mirror. */
function MirrorDictationIndicator({ phase }: { phase: DictationPhase }): React.JSX.Element {
  const transcript = useAppStore((s) => s.partialTranscript.trim())
  const isHoldMode = useAppStore((s) => s.settings?.voice?.dictationMode === 'hold')
  const meter = useDictationMeter()
  const shortcut = useShortcutKeyDetails('voice.dictation')
  const isListening = phase === 'listening'
  const isClipping = isListening && meter.isClipping
  const lifecycleLabel =
    phase === 'starting'
      ? translate('auto.components.dictation.DictationIndicator.7f3660a7ba', 'Starting mic…')
      : phase === 'finishing'
        ? translate('auto.components.dictation.DictationIndicator.f082d0cb9d', 'Processing…')
        : translate('auto.components.dictation.DictationIndicator.3de5a129e7', 'Listening')
  const label = isClipping
    ? translate('auto.components.dictation.DictationIndicator.4977162383', 'Too loud')
    : isListening && meter.isSpeaking
      ? translate('auto.components.dictation.DictationIndicator.25f2b7a6a5', 'Speaking')
      : lifecycleLabel
  const stopLabel = translate(
    'auto.components.dictation.DictationIndicator.335e1bc6cb',
    'Stop dictation'
  )
  return (
    <div
      data-clipping={isClipping}
      data-transcript={transcript !== ''}
      className="pointer-events-auto max-w-[calc(100%-1.5rem)] overflow-hidden rounded-full border border-border bg-popover/95 text-sm text-popover-foreground shadow-floating backdrop-blur data-[clipping=true]:border-destructive/40 data-[clipping=true]:text-destructive data-[transcript=true]:w-[28rem] data-[transcript=true]:rounded-xl"
    >
      <div className="flex h-10 items-center gap-2 px-2">
        <DictationGrapes
          level={meter.level}
          active={phase !== 'finishing'}
          transitioning={!isListening}
        />
        <span aria-hidden className="min-w-0 truncate font-medium">
          {label}
        </span>
        <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {isClipping ? label : lifecycleLabel}
        </span>
        {phase === 'finishing' ? null : (
          <>
            <span aria-hidden className="ml-0.5 h-4 w-px shrink-0 bg-border" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={stopLabel}
                  // Why: stopping must not take the keyboard from the terminal being dictated into.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => dispatchDictationControl('stop')}
                >
                  <Square className="size-3 fill-current" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6} className="flex items-center gap-1.5">
                {stopLabel}
                {!isHoldMode && shortcut.keys.length > 0 ? (
                  <ShortcutKeyCombo keys={shortcut.keys} doubleTap={shortcut.doubleTap} />
                ) : null}
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
      {transcript ? (
        <p className="truncate border-t border-border px-3 py-2 text-xs text-muted-foreground">
          {transcript}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Covers a mirror's terminal while a dictation that started there runs: a soft scrim and the
 * listening indicator inside the window, so it is plain which window is being dictated into.
 * The app-wide indicator stands down meanwhile and returns when this window goes away.
 */
export function AgentHubMirrorDictationOverlay({
  target,
  showsTerminal
}: {
  target: AgentHubPaneTarget
  /** False while the pane is elsewhere on screen; the app-wide indicator serves then. */
  showsTerminal: boolean
}): React.JSX.Element | null {
  const state = useAgentHubMirrorMicState(target, showsTerminal)
  // Why only 'stopping': a later phase this indicator has no controls for stays with the app's.
  const stopping = useAppStore((s) => s.dictationState === 'stopping')
  const phase =
    showsTerminal &&
    (state === 'starting' || state === 'listening' || (state === 'finishing' && stopping))
      ? state
      : null
  useMirrorShowsDictation(phase !== null)
  if (!phase) {
    return null
  }
  return (
    <div
      data-agent-hub-mirror-dictation={phase}
      // Why no pointer events: the terminal under the scrim stays usable; only the pill takes clicks.
      className="pointer-events-none absolute inset-0 z-10 flex animate-in items-end justify-center bg-background/50 pb-3 duration-150 fade-in-0"
    >
      <MirrorDictationIndicator phase={phase} />
    </div>
  )
}

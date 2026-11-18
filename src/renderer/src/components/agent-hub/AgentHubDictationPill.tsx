import { useState } from 'react'
import { Square, X } from 'lucide-react'
import { ShortcutKeyCombo } from '@/components/ui/ShortcutKeyCombo'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useShortcutKeyDetails } from '@/lib/keyboard/useShortcutLabel'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { dispatchDictationControl } from '../dictation/dictation-control-events'
import { DictationGrapes } from '../dictation/DictationGrapes'
import { useDictationMeter } from '../dictation/dictation-meter-store'
import { canCancelDictation, cancelDictation } from './agent-hub-dictation-cancel'
import { HubKeys } from './AgentHubInlineLabels'

type DictationPhase = 'starting' | 'listening' | 'finishing'

/** Shared controls for the mirror overlay and the reply field's inline pill. */
export function AgentHubDictationPill({
  phase,
  compact = false,
  disabled = false,
  stopActionId = 'voice.dictation',
  stopHint,
  responsiveHint = false
}: {
  phase: DictationPhase
  compact?: boolean
  disabled?: boolean
  stopActionId?: 'voice.dictation' | 'agentHub.toggleOrb'
  stopHint?: string
  responsiveHint?: boolean
}): React.JSX.Element {
  const transcript = useAppStore((s) => (compact ? '' : s.liveText.tentative.trim()))
  const isHoldMode = useAppStore((s) => s.settings?.voice?.dictationMode === 'hold')
  const meter = useDictationMeter()
  const shortcut = useShortcutKeyDetails(stopActionId)
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
  // Asked once per indicator: the controller that answers is mounted for the app's lifetime.
  const [canCancel] = useState(canCancelDictation)
  const cancelLabel = translate('agentHub.mirror.cancelDictation', 'Cancel dictation')
  const stopLabel = translate(
    'auto.components.dictation.DictationIndicator.335e1bc6cb',
    'Stop dictation'
  )
  return (
    <div
      data-agent-hub-dictate={compact ? 'listening' : undefined}
      data-clipping={isClipping}
      data-transcript={transcript !== ''}
      className={
        compact
          ? 'h-6 min-w-0 max-w-[70%] shrink-0 overflow-hidden rounded-full border border-border bg-popover/95 text-xs text-popover-foreground data-[clipping=true]:border-destructive/40 data-[clipping=true]:text-destructive'
          : 'pointer-events-auto max-w-[calc(100%-1.5rem)] overflow-hidden rounded-full border border-border bg-popover/95 text-sm text-popover-foreground shadow-floating backdrop-blur data-[clipping=true]:border-destructive/40 data-[clipping=true]:text-destructive data-[transcript=true]:w-[28rem] data-[transcript=true]:rounded-xl'
      }
    >
      <div
        className={
          compact
            ? 'flex h-full min-w-0 items-center gap-1 px-1'
            : 'flex h-10 items-center gap-2 px-2'
        }
      >
        <DictationGrapes level={meter.level} active={isListening} />
        <span aria-hidden className="min-w-0 truncate font-medium">
          {label}
        </span>
        <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {isClipping ? label : lifecycleLabel}
        </span>
        {/* Why on the pill: a stop shortcut kept in a tooltip goes unnoticed. */}
        {phase !== 'finishing' &&
        (!isHoldMode || stopHint) &&
        (shortcut.keys.length > 0 || stopHint) ? (
          <span
            aria-hidden
            data-agent-hub-dictation-stop-key
            className={
              responsiveHint
                ? 'hidden shrink-0 items-center gap-1 text-xs whitespace-nowrap text-muted-foreground @min-[24rem]/hub-dictation:flex'
                : compact && !stopHint
                  ? 'hidden shrink-0 items-center gap-1 text-xs whitespace-nowrap text-muted-foreground @min-[30rem]/hub-reply:flex'
                  : 'flex shrink-0 items-center gap-1 text-xs whitespace-nowrap text-muted-foreground'
            }
          >
            {shortcut.keys.length > 0 ? (
              <HubKeys keys={shortcut.keys} />
            ) : (
              <span>{translate('auto.agentHub.orb.notSet', 'Not set')}</span>
            )}
            {stopHint ?? translate('agentHub.mirror.dictationStopKey', 'to stop')}
          </span>
        ) : null}
        {phase === 'finishing' && !canCancel ? null : (
          <span aria-hidden className="ml-0.5 h-4 w-px shrink-0 bg-border" />
        )}
        {phase === 'finishing' ? null : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={stopLabel}
                disabled={disabled}
                tabIndex={compact ? -1 : undefined}
                // Why: stopping must not take the keyboard from the terminal being dictated into.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => dispatchDictationControl('stop')}
              >
                <Square className="size-3 fill-current" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              <span className="flex items-center gap-1.5">
                {stopLabel}
                {!isHoldMode && shortcut.keys.length > 0 ? (
                  <ShortcutKeyCombo keys={shortcut.keys} doubleTap={shortcut.doubleTap} />
                ) : null}
              </span>
            </TooltipContent>
          </Tooltip>
        )}
        {canCancel ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={cancelLabel}
                disabled={disabled}
                tabIndex={compact ? -1 : undefined}
                onMouseDown={(event) => event.preventDefault()}
                onClick={cancelDictation}
              >
                <X className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              {translate(
                'agentHub.mirror.cancelDictationHint',
                'Cancel dictation and discard what is not inserted yet'
              )}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {transcript ? (
        <p className="truncate border-t border-border px-3 py-2 text-xs text-muted-foreground">
          {transcript}
        </p>
      ) : null}
    </div>
  )
}

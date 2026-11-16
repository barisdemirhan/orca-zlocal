import { useTranslate } from '@/i18n/use-translate'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { AgentSessionContinuationContextMode } from '@/lib/agent-session/context/agent-session-continuation'

export function AgentSessionContinuationContextField({
  disabled,
  mode: contextMode,
  hasFullContext,
  preparing,
  sourceKind,
  onPick
}: {
  disabled: boolean
  mode: AgentSessionContinuationContextMode
  hasFullContext: boolean
  preparing: boolean
  sourceKind: string | undefined
  onPick: (mode: AgentSessionContinuationContextMode) => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <div className="min-w-0 space-y-1.5">
      <label className="text-xs font-medium">
        {t('components.agentSessionContinuation.context', 'Context')}
      </label>
      <Select
        disabled={disabled}
        value={contextMode}
        onValueChange={(value) => {
          if (value === 'focused' || value === 'full') {
            onPick(value)
          }
        }}
      >
        <SelectTrigger className="min-w-0 w-full" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="focused">
            {t('components.agentSessionContinuation.modeFocused', 'Focused handoff (Recommended)')}
          </SelectItem>
          <SelectItem value="full" disabled={!hasFullContext}>
            {t('components.agentSessionContinuation.modeFull', 'Full session transcript')}
          </SelectItem>
        </SelectContent>
      </Select>
      <p className="min-h-12 text-[11px] leading-4 text-muted-foreground">
        {preparing
          ? null
          : !hasFullContext
            ? sourceKind === 'chat'
              ? t(
                  'components.agentSessionContinuation.modeLoadedDescription',
                  'Uses recent messages currently loaded in this chat and the current workspace.'
                )
              : t(
                  'components.agentSessionContinuation.modeCapturedDescription',
                  'Uses captured text and the current workspace.'
                )
            : contextMode === 'focused'
              ? t(
                  'components.agentSessionContinuation.modeFocusedDescription',
                  'Uses the latest status and current workspace, reading older transcript details only when needed.'
                )
              : t(
                  'components.agentSessionContinuation.modeFullDescription',
                  'Asks the new Agent to read the complete saved session before continuing. This can take longer and use significant context, plan usage, or API credits.'
                )}
      </p>
    </div>
  )
}

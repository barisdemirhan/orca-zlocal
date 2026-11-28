import { useTranslate, type Translate } from '@/i18n/use-translate'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  AGENT_SESSION_CONTINUATION_PLACEMENTS,
  type AgentSessionContinuationPlacement
} from '@/lib/agent-session-continuation-placement'

function placementLabel(t: Translate, placement: AgentSessionContinuationPlacement): string {
  switch (placement) {
    case 'tab':
      return t('components.agentSessionContinuation.placementTab', 'New tab')
    case 'pane':
      return t('components.agentSessionContinuation.placementPane', 'New pane')
    case 'jump':
      return t('components.agentSessionContinuation.placementJump', 'Jump to it')
  }
}

function placementDescription(t: Translate, placement: AgentSessionContinuationPlacement): string {
  switch (placement) {
    case 'tab':
      return t(
        'components.agentSessionContinuation.placementTabDescription',
        'Adds it as a tab of this mirror and keeps you here.'
      )
    case 'pane':
      return t(
        'components.agentSessionContinuation.placementPaneDescription',
        'Splits beside this pane in its workspace and adds a mirror tab for the new one.'
      )
    case 'jump':
      return t(
        'components.agentSessionContinuation.placementJumpDescription',
        'Opens a new tab and switches the workspace to it.'
      )
  }
}

export function AgentSessionContinuationPlacementField({
  disabled,
  placement,
  onPick
}: {
  disabled: boolean
  placement: AgentSessionContinuationPlacement
  onPick: (placement: AgentSessionContinuationPlacement) => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <div className="min-w-0 space-y-1.5">
      <label className="text-xs font-medium">
        {t('components.agentSessionContinuation.openIn', 'Open in')}
      </label>
      <Select
        disabled={disabled}
        value={placement}
        onValueChange={(value) => {
          const next = AGENT_SESSION_CONTINUATION_PLACEMENTS.find((item) => item === value)
          if (next) {
            onPick(next)
          }
        }}
      >
        <SelectTrigger className="min-w-0 w-full" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AGENT_SESSION_CONTINUATION_PLACEMENTS.map((item) => (
            <SelectItem key={item} value={item}>
              {placementLabel(t, item)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[11px] leading-4 text-muted-foreground">
        {placementDescription(t, placement)}
      </p>
    </div>
  )
}

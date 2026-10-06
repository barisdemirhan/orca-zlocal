import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import {
  normalizeAgentHubMicMode,
  type AgentHubMicMode
} from '../../../../shared/agent-hub-settings'
import { SettingsSegmentedControl, SettingsRow } from '../settings/SettingsFormControls'
import { Button } from '../ui/button'
import { ButtonGroup } from '../ui/button-group'
import { ContextMenuItem } from '../ui/context-menu'
import { AgentHubShortcut } from './AgentHubShortcut'
import { readAgentHubDictationCapabilities } from './agent-hub-dictation-capabilities'

export function AgentHubMicModeControl({
  canImprove,
  menu = false
}: {
  canImprove: boolean
  menu?: boolean
}): React.JSX.Element {
  const mode = useAppStore((s) => normalizeAgentHubMicMode(s.settings?.agentHubMicMode))
  const updateSettings = useAppStore((s) => s.updateSettings)
  const plain = translate('agentHub.mic.dictate', 'Dictate')
  const improve = translate('agentHub.mic.dictateAndImprove', 'Dictate and improve')
  if (!canImprove) {
    return <span className="text-xs text-muted-foreground">{plain}</span>
  }
  const choose = (value: AgentHubMicMode): void => {
    if (value !== 'improve' || readAgentHubDictationCapabilities().improve) {
      void updateSettings({ agentHubMicMode: value })
    }
  }
  if (menu) {
    return (
      <ButtonGroup
        className="w-full"
        aria-label={translate('agentHub.mic.mode', 'Microphone action')}
      >
        {(['dictate', 'improve'] as const).map((value) => (
          <ContextMenuItem
            key={value}
            asChild
            role="menuitemradio"
            aria-label={value === 'dictate' ? plain : improve}
            aria-checked={mode === value}
            onSelect={(event) => {
              event.preventDefault()
              choose(value)
            }}
          >
            <Button
              variant={mode === value ? 'secondary' : 'ghost'}
              size="xs"
              className="h-auto min-w-0 flex-1"
            >
              <span className="flex min-w-0 flex-col items-center gap-1">
                <span className="whitespace-normal">{value === 'dictate' ? plain : improve}</span>
                <AgentHubShortcut
                  actionId={value === 'dictate' ? 'voice.dictation' : 'voice.dictationImprove'}
                  slot="context"
                />
              </span>
            </Button>
          </ContextMenuItem>
        ))}
      </ButtonGroup>
    )
  }
  return (
    <SettingsSegmentedControl<AgentHubMicMode>
      value={mode}
      equalWidth
      size="sm"
      ariaLabel={translate('agentHub.mic.mode', 'Microphone action')}
      onChange={choose}
      options={[
        {
          value: 'dictate',
          label: plain,
          tooltip: (
            <span className="flex items-center gap-2">
              {plain}
              <AgentHubShortcut actionId="voice.dictation" />
            </span>
          )
        },
        {
          value: 'improve',
          label: improve,
          tooltip: (
            <span className="flex items-center gap-2">
              {improve}
              <AgentHubShortcut actionId="voice.dictationImprove" />
            </span>
          )
        }
      ]}
    />
  )
}

export function AgentHubMicModeSetting(): React.JSX.Element {
  return (
    <SettingsRow
      label={translate('agentHub.mic.mode', 'Microphone action')}
      description={translate(
        'agentHub.mic.modeCopy',
        'Click a mirror’s microphone to start this mode. Shift-click starts the other mode when available.'
      )}
      control={<AgentHubMicModeControl canImprove={readAgentHubDictationCapabilities().improve} />}
    />
  )
}

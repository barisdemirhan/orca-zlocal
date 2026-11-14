import { translate } from '@/i18n/i18n'
import { getShortcutPlatform } from '@/lib/keyboard/shortcut-platform'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { AgentHubOrbAction } from '../../../../shared/agent-hub-settings'
import { agentHubOrbLaunchAction } from '../../../../shared/agent-hub-orb-settings'
import {
  SettingsRow,
  SettingsSegmentedControl
} from '../settings/form-controls/SettingsFormControls'
import { agentHubOrbActionLabel } from './agent-hub-orb-action-label'

export function AgentHubSettingsOrbActions({
  settings,
  updateSettings
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): React.JSX.Element {
  const modifier = getShortcutPlatform() === 'darwin' ? '⌘' : 'Ctrl'
  const unavailable = translate(
    'auto.agentHub.orb.voiceUnavailable',
    'Live voice is unavailable on this host.'
  )
  const options = [
    {
      value: 'live' as const,
      label: agentHubOrbActionLabel('live'),
      disabled: settings.agentHubOrbAgent !== 'codex',
      tooltip: settings.agentHubOrbAgent !== 'codex' ? unavailable : undefined
    },
    { value: 'dictate' as const, label: agentHubOrbActionLabel('dictate') },
    { value: 'text' as const, label: agentHubOrbActionLabel('text') }
  ]
  const actions: { alternate: boolean; label: string; description: string }[] = [
    {
      alternate: false,
      label: translate('agentHub.orb.defaultAction', 'Open Orb with'),
      description: translate(
        'agentHub.orb.defaultActionHint',
        'Used by the Orb button and shortcut.'
      )
    },
    {
      alternate: true,
      label: translate('agentHub.orb.alternateAction', '{{modifier}}-click action', { modifier }),
      description: translate(
        'agentHub.orb.alternateActionHint',
        'Opens this mode without changing the default action.'
      )
    }
  ]
  return (
    <>
      {actions.map(({ alternate, label, description }) => (
        <SettingsRow
          key={label}
          label={label}
          description={description}
          control={
            <SettingsSegmentedControl<AgentHubOrbAction>
              value={agentHubOrbLaunchAction(settings, alternate)}
              ariaLabel={label}
              onChange={(action) =>
                updateSettings(
                  alternate
                    ? { agentHubOrbAlternateAction: action }
                    : { agentHubOrbDefaultAction: action }
                )
              }
              options={options}
            />
          }
        />
      ))}
    </>
  )
}

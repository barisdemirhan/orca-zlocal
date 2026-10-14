import { translate } from '@/i18n/i18n'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { normalizeAgentHubOrbSettings } from '../../../../shared/agent-hub-orb-settings'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import {
  SettingsRow,
  SettingsSegmentedControl,
  SettingsSubsectionHeader,
  SettingsSwitchRow
} from '../settings/SettingsFormControls'
import { AgentHubOrbTalkShortcut } from './AgentHubOrbTalkShortcut'
import type { AgentHubShortcutEditor } from './use-agent-hub-shortcut-editor'
import { useAgentHubOrbOptions } from './use-agent-hub-orb-options'

export function AgentHubSettingsOrbSection({
  settings,
  updateSettings,
  shortcutEditor
}: {
  settings: GlobalSettings
  shortcutEditor: AgentHubShortcutEditor
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): React.JSX.Element {
  const orb = normalizeAgentHubOrbSettings(settings)
  const { agents, models } = useAgentHubOrbOptions(orb.agent)
  const agentLabel = translate('auto.agentHub.orb.agent', 'Agent')
  const modelLabel = translate('auto.agentHub.orb.model', 'Model')
  const defaultModel = translate('auto.agentHub.orb.agentDefault', 'Agent default')
  const approvalsLabel = translate('auto.agentHub.orb.approvals', 'Approvals')
  const placementLabel = translate('auto.agentHub.orb.placement', 'Placement')
  const placement =
    settings.agentHubOrbPlacement === 'statusBar' || settings.agentHubOrbPlacement === 'hidden'
      ? settings.agentHubOrbPlacement
      : 'dock'
  const chooseFolder = async (): Promise<void> => {
    const path = await window.api.app.pickFloatingWorkspaceDirectory()
    if (path) {
      updateSettings({ floatingTerminalCwd: path })
    }
  }
  return (
    <section className="space-y-3">
      <SettingsSubsectionHeader title={translate('auto.agentHub.settings.orb', 'Orb')} />
      <SettingsRow
        label={agentLabel}
        control={
          <Select
            value={orb.agent}
            onValueChange={(value) => {
              if (agents.some((agent) => agent.id === value)) {
                updateSettings({ agentHubOrbAgent: value, agentHubOrbModel: null })
              }
            }}
          >
            <SelectTrigger aria-label={agentLabel}>
              <SelectValue>
                {agents.find((agent) => agent.id === orb.agent)?.label ?? orb.agent}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <SettingsRow
        label={modelLabel}
        control={
          models.length > 0 ? (
            <Select
              value={orb.model ? `model:${orb.model}` : 'agent-default'}
              onValueChange={(value) =>
                updateSettings({
                  agentHubOrbModel: value === 'agent-default' ? null : value.slice('model:'.length)
                })
              }
            >
              <SelectTrigger aria-label={modelLabel}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agent-default">{defaultModel}</SelectItem>
                {orb.model && !models.some((model) => model.id === orb.model) ? (
                  <SelectItem value={`model:${orb.model}`}>{orb.model}</SelectItem>
                ) : null}
                {models.map((model) => (
                  <SelectItem key={model.id} value={`model:${model.id}`}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              aria-label={modelLabel}
              value={settings.agentHubOrbModel ?? ''}
              placeholder={defaultModel}
              onChange={(event) => updateSettings({ agentHubOrbModel: event.target.value || null })}
            />
          )
        }
      />
      <SettingsRow
        label={approvalsLabel}
        description={
          orb.permission === 'free'
            ? translate(
                'auto.agentHub.orb.freeWarning',
                'The Orb runs commands without asking. Use with care.'
              )
            : undefined
        }
        control={
          <SettingsSegmentedControl
            value={orb.permission}
            ariaLabel={approvalsLabel}
            onChange={(value) => updateSettings({ agentHubOrbPermission: value })}
            options={[
              { value: 'ask', label: translate('auto.agentHub.orb.ask', 'Ask') },
              { value: 'free', label: translate('auto.agentHub.orb.free', 'Act freely') }
            ]}
          />
        }
      />
      <SettingsRow
        label={translate('auto.agentHub.orb.workingFolder', 'Working folder')}
        description={
          <>
            {translate(
              'auto.agentHub.orb.sharedWorkingFolder',
              'Uses the floating workspace directory. Changes also apply to new floating tabs.'
            )}
            <span className="block break-all font-mono">{settings.floatingTerminalCwd || '~'}</span>
          </>
        }
        control={
          <Button type="button" variant="outline" size="xs" onClick={() => void chooseFolder()}>
            {translate('auto.agentHub.orb.choose', 'Choose…')}
          </Button>
        }
      />
      <SettingsRow
        label={placementLabel}
        control={
          <SettingsSegmentedControl
            value={placement}
            ariaLabel={placementLabel}
            onChange={(value) => updateSettings({ agentHubOrbPlacement: value })}
            options={[
              {
                value: 'dock',
                label: translate('auto.components.settings.ExperimentalPane.agentHub.dock', 'Dock')
              },
              {
                value: 'statusBar',
                label: translate(
                  'auto.components.settings.ExperimentalPane.agentHub.statusBar',
                  'Status bar'
                )
              },
              { value: 'hidden', label: translate('auto.agentHub.orb.hidden', 'Hidden') }
            ]}
          />
        }
      />
      <AgentHubOrbTalkShortcut editor={shortcutEditor} />
      <SettingsSwitchRow
        label={translate('auto.agentHub.orb.speakReplies', 'Speak replies')}
        description={translate('auto.agentHub.orb.comingLater', 'Coming later')}
        checked={false}
        disabled
        onChange={() => {}}
      />
    </section>
  )
}

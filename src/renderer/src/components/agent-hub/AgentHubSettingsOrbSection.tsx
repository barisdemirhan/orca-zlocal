import { translate } from '@/i18n/i18n'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import {
  normalizeAgentHubOrbSettings,
  agentHubOrbSupportsAsk
} from '../../../../shared/agent-hub-orb-settings'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import {
  SettingsRow,
  SettingsSegmentedControl,
  SettingsSubsectionHeader
} from '../settings/SettingsFormControls'
import { useAgentHubOrbOptions } from './use-agent-hub-orb-options'

export function AgentHubSettingsOrbSection({
  settings,
  updateSettings
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): React.JSX.Element {
  const orb = normalizeAgentHubOrbSettings(settings)
  const { agents, models, loading, refreshModels } = useAgentHubOrbOptions(orb.agent)
  const supportsAsk = agentHubOrbSupportsAsk(orb.agent)
  const askUnavailable = translate(
    'auto.agentHub.orb.piRequiresFree',
    'Pi requires Act freely. Choose another agent to ask before running commands.'
  )
  const agentLabel = translate('auto.agentHub.orb.agent', 'Agent')
  const modelLabel = translate('auto.agentHub.orb.model', 'Model')
  const defaultModel = translate('auto.agentHub.orb.agentDefault', 'Agent default')
  const approvalsLabel = translate('auto.agentHub.orb.approvals', 'Approvals')
  const placementLabel = translate('auto.agentHub.orb.placement', 'Placement')
  const placement =
    settings.agentHubOrbPlacement === 'dock' ||
    settings.agentHubOrbPlacement === 'statusBar' ||
    settings.agentHubOrbPlacement === 'hidden'
      ? settings.agentHubOrbPlacement
      : 'floating'
  const chooseFolder = async (): Promise<void> => {
    const path = await window.api.app.pickFloatingWorkspaceDirectory()
    if (path) {
      updateSettings({ floatingTerminalCwd: path })
    }
  }
  return (
    <section className="space-y-3">
      <SettingsSubsectionHeader
        title={translate('auto.agentHub.settings.orb', 'Orb')}
        description={translate(
          'agentHub.orb.settingsApply',
          'Agent, model and approval changes start a new conversation when Orb is idle. Past conversations keep their agent and model.'
        )}
      />
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
        description={
          orb.agent === 'codex' && models.length === 0
            ? loading
              ? translate('agentHub.orb.modelsLoading', 'Loading available models…')
              : translate(
                  'agentHub.orb.modelsUnavailable',
                  'Could not load available models. Open the model menu to retry.'
                )
            : undefined
        }
        control={
          orb.agent === 'codex' || models.length > 0 ? (
            <Select
              value={orb.model ? `model:${orb.model}` : 'agent-default'}
              onOpenChange={(open) => {
                if (open && orb.agent === 'codex') {
                  refreshModels()
                }
              }}
              onValueChange={(value) => {
                if (
                  orb.agent === 'codex' &&
                  value !== 'agent-default' &&
                  !models.some((model) => `model:${model.id}` === value)
                ) {
                  return
                }
                updateSettings({
                  agentHubOrbModel: value === 'agent-default' ? null : value.slice('model:'.length)
                })
              }}
            >
              <SelectTrigger aria-label={modelLabel}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agent-default">{defaultModel}</SelectItem>
                {orb.model && !models.some((model) => model.id === orb.model) ? (
                  <SelectItem value={`model:${orb.model}`} disabled={orb.agent === 'codex'}>
                    {orb.model}
                    {orb.agent === 'codex'
                      ? ` · ${translate('agentHub.orb.modelUnavailable', 'Unavailable')}`
                      : ''}
                  </SelectItem>
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
          !supportsAsk
            ? askUnavailable
            : orb.permission === 'free'
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
              {
                value: 'ask',
                label: translate('auto.agentHub.orb.ask', 'Ask'),
                disabled: !supportsAsk,
                tooltip: !supportsAsk ? askUnavailable : undefined
              },
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
              { value: 'floating', label: translate('auto.agentHub.orb.floating', 'Floating') },
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
    </section>
  )
}

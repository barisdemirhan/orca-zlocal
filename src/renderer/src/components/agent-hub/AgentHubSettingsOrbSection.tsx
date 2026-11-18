import { useEffect, useState } from 'react'
import { translate } from '@/i18n/i18n'
import type { GlobalSettings } from '../../../../shared/settings/global-settings-types'
import {
  normalizeAgentHubOrbSettings,
  agentHubOrbOfferedModes,
  agentHubOrbPermissionSettingValue,
  agentHubOrbSupportsAsk,
  resolveAgentHubOrbMode
} from '../../../../shared/agent-hub-orb-settings'
import { nativeChatPermissionModeLabel } from '../native-chat/session/options/controls/native-chat-permission-mode-labels'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import {
  SettingsRow,
  SettingsSegmentedControl,
  SettingsSubsectionHeader
} from '../settings/form-controls/SettingsFormControls'
import { useAgentHubOrbOptions } from './use-agent-hub-orb-options'
import { AgentHubSettingsOrbActions } from './AgentHubSettingsOrbActions'
import { AgentHubSettingsOrbIdentity } from './AgentHubSettingsOrbIdentity'
import { AgentHubSettingsOrbMemory } from './AgentHubSettingsOrbMemory'

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
  const permission =
    resolveAgentHubOrbMode(orb.agent, orb.permission) ?? orb.permission ?? 'full-access'
  const askUnavailable = translate(
    'auto.agentHub.orb.piRequiresFree',
    'Pi requires Full access. Choose another agent to ask before running commands.'
  )
  const agentLabel = translate('auto.agentHub.orb.agent', 'Agent')
  const modelLabel = translate('auto.agentHub.orb.model', 'Model')
  const defaultModel = translate('auto.agentHub.orb.agentDefault', 'Agent default')
  const approvalsLabel = translate('auto.agentHub.orb.approvals', 'Approvals')
  const permissionOptions = [
    // Why: Pi cannot ask, so its Ask stays visible but off, with the reason on hover.
    ...(supportsAsk
      ? []
      : [
          {
            value: 'ask' as const,
            label: nativeChatPermissionModeLabel('ask'),
            disabled: true,
            tooltip: askUnavailable
          }
        ]),
    ...agentHubOrbOfferedModes(orb.agent).map((mode) => ({
      value: mode,
      label: nativeChatPermissionModeLabel(mode)
    }))
  ]
  const placementLabel = translate('auto.agentHub.orb.placement', 'Placement')
  const placement =
    settings.agentHubOrbPlacement === 'dock' ||
    settings.agentHubOrbPlacement === 'statusBar' ||
    settings.agentHubOrbPlacement === 'hidden'
      ? settings.agentHubOrbPlacement
      : 'floating'
  const [orbDirectory, setOrbDirectory] = useState('')
  useEffect(() => {
    let active = true
    void window.api.app
      .getAgentHubOrbDirectory()
      .then((directory) => {
        if (active) {
          setOrbDirectory(directory)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  return (
    <section className="@container space-y-3">
      <SettingsSubsectionHeader
        title={translate('auto.agentHub.settings.orb', 'Orb')}
        description={translate(
          'agentHub.orb.settingsApply',
          'Agent, model and approval changes start a new conversation when Orb is idle. Past conversations keep their agent and model.'
        )}
      />
      <AgentHubSettingsOrbActions settings={settings} updateSettings={updateSettings} />
      <AgentHubSettingsOrbIdentity settings={settings} updateSettings={updateSettings} />
      <AgentHubSettingsOrbMemory
        settings={settings}
        updateSettings={updateSettings}
        orbDirectory={orbDirectory}
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
        // Why: four modes do not fit beside the label in the Orb panel and covered it.
        className="flex-col items-stretch @xl:flex-row @xl:items-center"
        label={approvalsLabel}
        description={
          !supportsAsk
            ? askUnavailable
            : permission === 'full-access'
              ? translate(
                  'auto.agentHub.orb.freeWarning',
                  'The Orb runs commands without asking. Use with care.'
                )
              : undefined
        }
        control={
          <SettingsSegmentedControl
            value={permission}
            ariaLabel={approvalsLabel}
            wrap
            onChange={(value) =>
              updateSettings({
                agentHubOrbPermission: agentHubOrbPermissionSettingValue(value)
              })
            }
            options={permissionOptions}
          />
        }
      />
      <SettingsRow
        label={translate('auto.agentHub.orb.workingFolder', 'Working folder')}
        description={
          <>
            {translate(
              'agentHub.orb.ownFolder',
              'Orb works in its own folder. Its instructions are written there as CLAUDE.md and AGENTS.md.'
            )}
            {orbDirectory ? (
              <span className="block break-all font-mono">{orbDirectory}</span>
            ) : null}
          </>
        }
        control={null}
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

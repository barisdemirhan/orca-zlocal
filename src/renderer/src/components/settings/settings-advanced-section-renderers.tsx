import { lazy, Suspense } from 'react'
import { AgentHubSettingsPane } from '../agent-hub/AgentHubSettingsPane'
import { AdvancedPane } from './AdvancedPane'
import { ExperimentalPane } from './ExperimentalPane'
import { PluginsSettingsSection } from './PluginsSettingsSection'
import { SettingsSection } from './SettingsSection'
import { translate } from '@/i18n/i18n'
import type { SettingsRenderContext } from './settings-render-context'

const DevToolsPane = import.meta.env.DEV
  ? lazy(() => import('./DevToolsPane').then((module) => ({ default: module.DevToolsPane })))
  : null

export function renderAdvancedSettingsSection(
  context: SettingsRenderContext
): React.JSX.Element | null {
  const { model, navigation, view } = context
  return model.showDesktopOnlySettings ? (
    <SettingsSection
      id="advanced"
      title={translate('auto.components.settings.Settings.1c87f8d024', 'Advanced')}
      description={translate(
        'auto.components.settings.Settings.499c1cd7f9',
        'Low-level compatibility settings for troubleshooting.'
      )}
      searchEntries={navigation.getSectionSearchEntries('advanced')}
    >
      {view.isSectionMounted('advanced') ? (
        <AdvancedPane settings={model.settings} updateSettings={model.updateSettings} />
      ) : null}
    </SettingsSection>
  ) : null
}

export function renderDevSettingsSection(context: SettingsRenderContext): React.JSX.Element | null {
  const { model, navigation, view } = context
  return model.showDesktopOnlySettings && import.meta.env.DEV ? (
    <SettingsSection
      id="dev"
      title={translate('auto.components.settings.Settings.dev', 'Dev Tools')}
      description={translate(
        'auto.components.settings.Settings.devDescription',
        'Dev-only tools for exercising UI states.'
      )}
      searchEntries={navigation.getSectionSearchEntries('dev')}
    >
      {DevToolsPane && view.isSectionMounted('dev') ? (
        <Suspense fallback={null}>
          <DevToolsPane />
        </Suspense>
      ) : null}
    </SettingsSection>
  ) : null
}

export function renderExperimentalSettingsSection(
  context: SettingsRenderContext
): React.JSX.Element {
  const { model, navigation, view } = context
  return (
    <SettingsSection
      id="experimental"
      title={translate('auto.components.settings.Settings.8b017f2506', 'Experimental')}
      description={translate(
        'auto.components.settings.Settings.075341c763',
        'New features that are still taking shape. Give them a try.'
      )}
      searchEntries={navigation.getSectionSearchEntries('experimental')}
      // Option-click unlocks hidden staff controls for this session, matching Updates.
      onTitleClick={(event) => {
        if (event.altKey) {
          model.setHiddenExperimentalUnlocked((previous) => !previous)
        }
      }}
    >
      {view.isSectionMounted('experimental') ? (
        <ExperimentalPane
          settings={model.settings}
          updateSettings={model.updateSettings}
          hiddenExperimentalUnlocked={model.hiddenExperimentalUnlocked}
        />
      ) : null}
    </SettingsSection>
  )
}

export function renderPluginsSettingsSection(
  context: SettingsRenderContext
): React.JSX.Element | null {
  const { model, view } = context
  return model.showDesktopOnlySettings ? (
    <PluginsSettingsSection
      mounted={view.isSectionMounted('plugins')}
      settings={model.settings}
      updateSettings={model.updateSettingsOrThrow}
    />
  ) : null
}

export function renderAgentHubSettingsSection(
  context: SettingsRenderContext
): React.JSX.Element | null {
  const { model, navigation, view } = context
  if (model.settings.experimentalAgentHub !== true) {
    return null
  }
  return (
    <SettingsSection
      id="agentHub"
      title={translate('auto.agentHub.settings.title', 'Agent Hub')}
      description={translate(
        'auto.agentHub.settings.description',
        'Dock, alerts, mirrors, voice and Orb preferences.'
      )}
      searchEntries={navigation.getSectionSearchEntries('agentHub')}
    >
      {view.isSectionMounted('agentHub') ? (
        <AgentHubSettingsPane settings={model.settings} updateSettings={model.updateSettings} />
      ) : null}
    </SettingsSection>
  )
}

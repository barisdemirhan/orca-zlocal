import type { SettingsSearchEntry } from '../settings/settings-search'
import { translate } from '@/i18n/i18n'
import { translateSearchKeyword } from '../settings/settings-search-keywords'

export function getAgentHubSearchEntry(): SettingsSearchEntry {
  return {
    title: translate('auto.components.settings.experimental.search.agentHub.title', 'Agent Hub'),
    description: translate(
      'auto.components.settings.experimental.search.agentHub.description',
      'Status bar popover with every agent and terminal: answer questions, approve commands, and jump to any pane.'
    ),
    keywords: [
      ...translateSearchKeyword(
        'auto.components.settings.experimental.search.0d24759f14',
        'experimental'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.experimental.search.agentHub.agents',
        'agents'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.experimental.search.agentHub.inbox',
        'inbox'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.experimental.search.agentHub.statusBar',
        'status bar'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.experimental.search.agentHub.terminals',
        'terminals'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.experimental.search.agentHub.questions',
        'questions'
      )
    ]
  }
}

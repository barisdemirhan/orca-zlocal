import type { SettingsSearchEntry } from '../settings/search/settings-search'
import { translate } from '@/i18n/i18n'
import { translateSearchKeyword } from '../settings/search/settings-search-keywords'

export function getAgentHubSearchEntry(): SettingsSearchEntry {
  return {
    title: translate('auto.components.settings.experimental.search.agentHub.title', 'Agent Hub'),
    description: translate(
      'auto.components.settings.experimental.search.agentHub.description',
      'One place for every agent and terminal: answer questions, approve commands, and jump to any pane.'
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
        'auto.components.settings.experimental.search.agentHub.alerts',
        'alerts'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.experimental.search.agentHub.sound',
        'sound'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.experimental.search.agentHub.notifications',
        'notifications'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.experimental.search.agentHub.dock',
        'dock'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.experimental.search.agentHub.notch',
        'notch'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.experimental.search.agentHub.mute',
        'mute'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.experimental.search.agentHub.questions',
        'questions'
      ),
      ...translateSearchKeyword('auto.agentHub.search.mirror', 'mirror'),
      ...translateSearchKeyword('auto.agentHub.search.canvas', 'canvas'),
      ...translateSearchKeyword('auto.agentHub.search.dim', 'dim'),
      ...translateSearchKeyword('auto.agentHub.search.quickreply', 'quick reply'),
      ...translateSearchKeyword('auto.agentHub.search.outline', 'outline'),
      ...translateSearchKeyword('auto.agentHub.search.tray', 'tray'),
      ...translateSearchKeyword('auto.agentHub.search.popout', 'pop out'),
      ...translateSearchKeyword('auto.agentHub.search.microphone', 'microphone'),
      ...translateSearchKeyword('auto.agentHub.search.shortcut', 'shortcut'),
      ...translateSearchKeyword('auto.agentHub.search.restore', 'restore'),
      ...translateSearchKeyword('auto.agentHub.search.shells', 'shells'),
      ...translateSearchKeyword('auto.agentHub.search.orb', 'orb'),
      ...translateSearchKeyword('auto.agentHub.search.voice', 'voice')
    ]
  }
}

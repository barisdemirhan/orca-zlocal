import { translate } from '@/i18n/i18n'
import { AGENT_HUB_ORB_OPEN_CHATS_LIMITS } from '../../../../shared/agent-hub-surface-settings'
import type { AgentHubSettingsSectionProps } from './agent-hub-settings-section-props'
import { SurfaceChoiceRow } from './AgentHubSettingsSurfaceRows'

export function AgentHubSettingsOrbChatRows({
  updateSettings
}: Pick<AgentHubSettingsSectionProps, 'updateSettings'>): React.JSX.Element {
  return (
    <>
      <SurfaceChoiceRow
        settingKey="agentHubOrbOpenChatsLimit"
        label={translate('agentHub.settings.orbOpenChatsLimit', 'Open chats limit')}
        description={translate(
          'agentHub.settings.orbOpenChatsLimitCopy',
          'At the limit, the longest idle chat leaves the strip. It stays in Chats.'
        )}
        options={AGENT_HUB_ORB_OPEN_CHATS_LIMITS.map((value) => ({
          value,
          label: String(value)
        }))}
        updateSettings={updateSettings}
      />
      <SurfaceChoiceRow
        settingKey="agentHubOrbNewChatAction"
        label={translate('agentHub.settings.orbNewChatAction', '"+" opens')}
        options={[
          { value: 'new-chat', label: translate('agentHub.settings.orbNewChat', 'New chat') },
          {
            value: 'clear-home',
            label: translate('agentHub.settings.orbClearHome', 'Clear home chat')
          }
        ]}
        updateSettings={updateSettings}
      />
    </>
  )
}

import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { NativeChatComposerPermissionPicker } from '../native-chat/session/options/controls/NativeChatPermissionModePicker'
import { NativeChatSessionOptionPickers } from '../native-chat/session/options/controls/NativeChatSessionOptionPickers'
import { NativeChatContextUsageRing } from '../native-chat/usage/NativeChatContextUsageRing'
import { useAgentHubMirrorChatSettings } from './agent-hub-mirror-chat-feed'
import { DrawerNote, DrawerSection } from './AgentHubMirrorDrawerParts'

/** The chat's own model, effort, permission, fast-mode and context controls, the same components as its composer. */
export function AgentHubMirrorSettingsDrawer({
  tabId,
  isChat,
  disabled
}: {
  tabId: string
  isChat: boolean
  disabled: boolean
}): React.JSX.Element {
  const settings = useAgentHubMirrorChatSettings(tabId)
  if (!settings) {
    return (
      <DrawerNote>
        {isChat
          ? translate(
              'agentHub.mirror.drawer.settingsClosed',
              'Settings show here while the chat is open.'
            )
          : translate(
              'agentHub.mirror.drawer.settingsUnreported',
              'This terminal does not report its settings.'
            )}
      </DrawerNote>
    )
  }
  return (
    <>
      <DrawerSection label={translate('agentHub.mirror.drawer.settings', 'Settings')} />
      <div className="flex flex-wrap items-center gap-2 p-3">
        <NativeChatSessionOptionPickers
          disabled={disabled}
          surface={settings.surface}
          snapshot={settings.snapshot}
          isWorking={settings.isWorking}
        />
        <NativeChatComposerPermissionPicker
          disabled={disabled}
          surface={settings.surface}
          snapshot={settings.snapshot}
        />
        {settings.contextUsage ? (
          <NativeChatContextUsageRing usage={settings.contextUsage} />
        ) : null}
        {settings.offersCompact ? (
          <Button
            variant="outline"
            size="xs"
            disabled={disabled || settings.compact === null}
            onClick={() => settings.compact?.()}
          >
            {settings.compacting
              ? translate('agentHub.mirror.drawer.compacting', 'Compacting…')
              : translate('agentHub.mirror.drawer.compact', 'Compact')}
          </Button>
        ) : null}
      </div>
    </>
  )
}

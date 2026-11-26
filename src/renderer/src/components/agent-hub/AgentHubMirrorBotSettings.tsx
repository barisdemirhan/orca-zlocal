import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { openBotHome, updateBot } from '@/lib/bot-catalog'
import { useAppStore } from '@/store'
import type { Bot } from '../../../../shared/bot-types'
import type { BotUpdateParams } from '../../../../shared/rpc-contract/bots-params'
import { BotAgentSettings } from '../settings/bots/BotGeneralSettings'
import { useBotConnectorEntries } from '../bots/bot-connector-entries'
import { openBotConnectorsTab } from '../bots/bot-settings-open'
import { useBotActivity } from '../bots/use-bot-activity'
import { AgentHubMirrorBotFace } from './AgentHubMirrorBotFace'
import { DrawerLink, DrawerRow, DrawerSection } from './AgentHubMirrorDrawerParts'
import { useAgentHubMirrorChatSettings } from './agent-hub-mirror-chat-feed'
import { sleepAgentHubOrb } from './agent-hub-orb-sleep'

function openBotAutomations(bot: Bot): void {
  if (openBotHome(bot)) {
    const { setRightSidebarTab, setRightSidebarOpen } = useAppStore.getState()
    setRightSidebarTab('bot-activity')
    setRightSidebarOpen(true)
  }
}

/** The bot's own settings beside its chat: what runs it, what it can reach, and this chat's compact. */
export function AgentHubMirrorBotSettings({
  tabId,
  bot,
  isOrb,
  disabled
}: {
  tabId: string
  bot: Bot
  isOrb: boolean
  disabled: boolean
}): React.JSX.Element {
  const connectors = useBotConnectorEntries(bot).length
  const automations = useBotActivity(bot).automations.length
  const settings = useAgentHubMirrorChatSettings(tabId)
  const update = (updates: BotUpdateParams['updates']): Promise<Bot | null> =>
    updateBot(bot, updates).catch(() => null)
  return (
    <>
      <div className="flex items-center gap-2 px-2 pt-3 pb-1 text-[13px] font-semibold">
        <AgentHubMirrorBotFace bot={bot} size={20} />
        <span className="min-w-0 truncate">
          {translate('agentHub.mirror.bot.settingsTitle', '{{name}} settings', { name: bot.name })}
        </span>
      </div>
      <DrawerSection label={translate('agentHub.mirror.bot.model', 'Model')} />
      <p className="px-2 pb-1 text-xs text-muted-foreground">
        {translate('agentHub.mirror.bot.modelNote', "For all of the bot's chats")}
      </p>
      <BotAgentSettings bot={bot} update={update} />
      <DrawerSection label={translate('agentHub.mirror.bot.connectors', 'Connectors')} />
      <DrawerRow
        trail={
          <DrawerLink onClick={() => openBotConnectorsTab(bot)}>
            {translate('agentHub.mirror.bot.manage', 'Manage')}
          </DrawerLink>
        }
      >
        {connectors}
      </DrawerRow>
      <DrawerSection label={translate('agentHub.mirror.bot.automations', 'Automations')} />
      <DrawerRow
        trail={
          <DrawerLink onClick={() => openBotAutomations(bot)}>
            {translate('agentHub.mirror.bot.manage', 'Manage')}
          </DrawerLink>
        }
      >
        {automations}
      </DrawerRow>
      {isOrb ? (
        <div className="px-2 pt-3">
          <Button
            variant="outline"
            size="xs"
            disabled={disabled}
            onClick={() => void sleepAgentHubOrb()}
          >
            {translate('agentHub.mirror.bot.sleep', 'Put to sleep')}
          </Button>
        </div>
      ) : null}
      {settings?.offersCompact ? (
        <>
          <DrawerSection label={translate('agentHub.mirror.bot.thisChat', 'This chat')} />
          <div className="px-2">
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
          </div>
        </>
      ) : null}
      <div className="px-2 pt-3">
        <Button variant="ghost" size="xs" onClick={() => openBotHome(bot)}>
          {translate('agentHub.mirror.bot.openPage', 'Open bot page')}
        </Button>
      </div>
    </>
  )
}

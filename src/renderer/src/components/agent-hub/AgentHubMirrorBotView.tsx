import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { botRefKey } from '@/lib/bot-hosts'
import { AgentHubMirrorBotSettings } from './AgentHubMirrorBotSettings'
import {
  AGENT_HUB_BOT_PAGE_TABS,
  AgentHubOrbWindowPane,
  AgentHubOrbWindowTabs
} from './AgentHubOrbWindowPanes'
import { useAgentHubBotNeedsList } from './agent-hub-bot-needs-store'
import {
  agentHubMirrorBotSurface,
  setAgentHubMirrorBotSettings,
  setAgentHubMirrorBotTab,
  useAgentHubMirrorBotView,
  type AgentHubMirrorBotTab
} from './agent-hub-mirror-bot-tab-store'
import type { AgentHubMirrorBotChat } from './agent-hub-mirror-bot-chat'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { useAgentHubMirrorBotChatOpenOverride } from './use-agent-hub-mirror-bot-chat-open-override'

/** The bot's Home, Chats, Connectors and Activity beside its chat; Activity also holds its settings. */
export function AgentHubMirrorBotView({
  windowId,
  target,
  botChat,
  disabled
}: {
  windowId: string
  target: AgentHubPaneTarget
  botChat: AgentHubMirrorBotChat
  disabled: boolean
}): React.JSX.Element {
  const { bot, isOrb } = botChat
  const { tab, settings } = useAgentHubMirrorBotView(windowId)
  const override = useAgentHubMirrorBotChatOpenOverride(target, botChat)
  const needs =
    useAgentHubBotNeedsList().find((entry) => entry.botKey === botRefKey(bot))?.count ?? 0
  return (
    <div data-agent-hub-mirror-bot-view className="flex min-h-0 flex-1 flex-col">
      <AgentHubOrbWindowTabs
        tab={tab}
        tabs={AGENT_HUB_BOT_PAGE_TABS}
        needs={needs}
        chatWaiting={false}
        onSelect={(next) => setAgentHubMirrorBotTab(windowId, next as AgentHubMirrorBotTab)}
      />
      {settings ? (
        <div className="scrollbar-sleek flex min-h-0 flex-1 flex-col overflow-y-auto">
          <AgentHubMirrorBotSettings
            tabId={target.tab.id}
            bot={bot}
            isOrb={isOrb}
            disabled={disabled}
          />
        </div>
      ) : (
        <AgentHubOrbWindowPane
          bot={bot}
          tab={tab}
          override={override}
          activitySurface={agentHubMirrorBotSurface(windowId)}
        />
      )}
      {tab === 'activity' ? (
        <div className="flex shrink-0 justify-end border-t border-border px-2 py-1">
          <Button
            variant="ghost-muted"
            size="xs"
            aria-pressed={settings}
            onClick={() => setAgentHubMirrorBotSettings(windowId, !settings)}
          >
            <Settings2 className="size-3" />
            {settings
              ? translate('agentHub.mirror.bot.backToActivity', 'Back to activity')
              : translate('agentHub.mirror.bot.settings', 'Bot settings')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

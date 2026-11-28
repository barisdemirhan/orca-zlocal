import { useListedBots } from '@/lib/use-listed-bots'
import { agentHubTabLabel } from './agent-hub-copy'
import { agentHubTabs, type AgentHubTab } from './agent-hub-keys'
import { useAgentHubBotsActive } from './agent-hub-bot-identity'

/** The hub's tab strip: the Bots tab joins it while bots are on, and a picked Bots tab falls back to Inbox once they are off. */
export function useAgentHubBotsTab(picked: AgentHubTab): {
  tab: AgentHubTab
  tabs: readonly AgentHubTab[]
  options: { value: AgentHubTab; label: string }[]
  botCount: number
} {
  const active = useAgentHubBotsActive()
  const botCount = useListedBots(active).length
  const tabs = agentHubTabs(active)
  return {
    tab: picked === 'bots' && !active ? 'inbox' : picked,
    tabs,
    options: tabs.map((value) => ({ value, label: agentHubTabLabel(value) })),
    botCount
  }
}

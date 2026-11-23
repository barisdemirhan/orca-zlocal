import { agentHubOrbAccessRank } from './agent-hub-orb-permission-settings'
import { normalizeAgentHubOrbSettings } from '../../../shared/agent-hub-orb-settings'
import type { RuntimeStore } from '../../runtime/construction/runtime-store-contract'
import type { AgentHubOrbBotChats } from './agent-hub-orb-bot-session'
import { AgentHubOrbSessionManager, type OrbRuntime } from './agent-hub-orb-session-manager'

/** The runtime's Orb: stops its chat when the saved access narrows or Agent Hub turns off. */
export function createAgentHubOrbSessionManager(
  runtime: OrbRuntime,
  store: Pick<RuntimeStore, 'getSettings' | 'updateSettings' | 'onSettingsChanged'> | null,
  resolveDirectory?: () => Promise<string>,
  botChats?: AgentHubOrbBotChats
): AgentHubOrbSessionManager {
  const manager = new AgentHubOrbSessionManager(
    runtime,
    () => store?.getSettings?.() ?? {},
    (cwd) => {
      if (!store?.updateSettings) {
        throw new Error('runtime_unavailable')
      }
      store.updateSettings({ agentHubOrbCwd: cwd }, { notifyListeners: true })
    },
    resolveDirectory,
    botChats
  )
  // Why: partial stores (tests, early boot) have no getSettings.
  let permission = normalizeAgentHubOrbSettings(store?.getSettings?.() ?? {}).permission
  let enabled = runtime.isAgentHubEnabled()
  store?.onSettingsChanged?.(() => {
    const next = normalizeAgentHubOrbSettings(store.getSettings()).permission
    // Why: with no choice the next chat gets Approve for me at most; compare against what the open chat really runs.
    const applied = manager.appliedAccessRank() ?? agentHubOrbAccessRank(permission)
    const restrict = agentHubOrbAccessRank(next) < applied
    const nextEnabled = runtime.isAgentHubEnabled()
    const disabled = enabled && !nextEnabled
    permission = next
    enabled = nextEnabled
    if (restrict || disabled) {
      void manager.close().catch((error: unknown) => {
        console.warn('Could not stop Orb after its settings changed', error)
      })
    }
  })
  return manager
}

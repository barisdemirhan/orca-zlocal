import { ipcMain } from 'electron'
import type { AgentHubOrbIdentityFiles } from '../../shared/agent-hub-orb-identity'
import type { Store } from '../persistence/loading-store/store'
import {
  agentHubOrbIdentityOptions,
  getAgentHubOrbDirectory,
  refreshAgentHubOrbInstructions
} from '../agent-hub/orb/agent-hub-orb-directory'
import {
  forgetAgentHubOrbMemory,
  readAgentHubOrbMemory,
  readAgentHubOrbSoul,
  readAgentHubOrbUser,
  writeAgentHubOrbSoul,
  writeAgentHubOrbUser
} from '../agent-hub/orb/agent-hub-orb-identity-files'

async function refresh(store: Store): Promise<{ truncated: boolean }> {
  return refreshAgentHubOrbInstructions(
    getAgentHubOrbDirectory(),
    agentHubOrbIdentityOptions(store.getSettings())
  )
}

async function readIdentity(store: Store): Promise<AgentHubOrbIdentityFiles> {
  const directory = getAgentHubOrbDirectory()
  const [soul, user, memory, { truncated }] = await Promise.all([
    readAgentHubOrbSoul(directory),
    readAgentHubOrbUser(directory),
    readAgentHubOrbMemory(directory),
    refresh(store)
  ])
  return { soul, user, memory, truncated }
}

export function registerAgentHubOrbIdentityHandlers(store: Store): void {
  ipcMain.handle('app:readAgentHubOrbIdentity', () => readIdentity(store))
  ipcMain.handle('app:writeAgentHubOrbSoul', async (_event, text: unknown) => {
    await writeAgentHubOrbSoul(typeof text === 'string' ? text : '')
    return readIdentity(store)
  })
  ipcMain.handle('app:writeAgentHubOrbUser', async (_event, text: unknown) => {
    await writeAgentHubOrbUser(typeof text === 'string' ? text : '')
    return readIdentity(store)
  })
  ipcMain.handle('app:forgetAgentHubOrbMemory', async (_event, line: unknown) => {
    await forgetAgentHubOrbMemory(typeof line === 'string' ? line : null)
    return readIdentity(store)
  })
  ipcMain.handle('app:refreshAgentHubOrbInstructions', async () => refresh(store))
}

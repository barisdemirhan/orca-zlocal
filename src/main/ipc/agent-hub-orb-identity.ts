import { ipcMain } from 'electron'
import type { AgentHubOrbIdentityFiles } from '../../shared/agent-hub-orb-identity'
import type { Store } from '../persistence/loading-store/store'
import {
  agentHubOrbIdentityOptions,
  getAgentHubOrbDirectory,
  refreshAgentHubOrbInstructions
} from '../agent-hub/orb/agent-hub-orb-directory'
import {
  agentHubOrbIdentityDirectory,
  findAgentHubOrbBot
} from '../agent-hub/orb/agent-hub-orb-bot'
import {
  forgetAgentHubOrbMemory,
  readAgentHubOrbMemory,
  readAgentHubOrbSoul,
  readAgentHubOrbUser,
  writeAgentHubOrbSoul,
  writeAgentHubOrbUser
} from '../agent-hub/orb/agent-hub-orb-identity-files'

/** The Orb bot writes its own instructions from its home files; only the Orb folder needs this. */
async function refresh(store: Store): Promise<{ truncated: boolean }> {
  if (findAgentHubOrbBot(store.getBots())) {
    return { truncated: false }
  }
  return refreshAgentHubOrbInstructions(
    getAgentHubOrbDirectory(),
    agentHubOrbIdentityOptions(store.getSettings())
  )
}

async function readIdentity(store: Store): Promise<AgentHubOrbIdentityFiles> {
  const directory = agentHubOrbIdentityDirectory(store.getBots())
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
    await writeAgentHubOrbSoul(
      typeof text === 'string' ? text : '',
      agentHubOrbIdentityDirectory(store.getBots())
    )
    return readIdentity(store)
  })
  ipcMain.handle('app:writeAgentHubOrbUser', async (_event, text: unknown) => {
    await writeAgentHubOrbUser(
      typeof text === 'string' ? text : '',
      agentHubOrbIdentityDirectory(store.getBots())
    )
    return readIdentity(store)
  })
  ipcMain.handle('app:forgetAgentHubOrbMemory', async (_event, line: unknown) => {
    await forgetAgentHubOrbMemory(
      typeof line === 'string' ? line : null,
      agentHubOrbIdentityDirectory(store.getBots())
    )
    return readIdentity(store)
  })
  ipcMain.handle('app:refreshAgentHubOrbInstructions', async () => refresh(store))
}

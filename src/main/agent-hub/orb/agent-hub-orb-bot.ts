// The Orb as a reserved local bot: found by its role, made once from the hub-orb template, and kept in step
// with the Orb settings, which stay the place its name, agent, model and permission are chosen.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { isBotAgent, type Bot } from '../../../shared/bot-types'
import { agentHubOrbSoulText } from '../../../shared/agent-hub-orb-identity'
import {
  normalizeAgentHubOrbIdentitySettings,
  normalizeAgentHubOrbSettings
} from '../../../shared/agent-hub-orb-settings'
import type { AgentHubSettings } from '../../../shared/agent-hub-settings'
import type { BotHostUpdates } from '../../../shared/rpc-contract/bots-params'
import { botHomeFolder } from '../../bots/bot-home'
import type { BotController } from '../../bots/bot-controller'
import { createBotFromTemplate, type BotTemplateCreateDeps } from '../../bots/bot-template-create'
import { AGENT_HUB_ORB_BOT_USER_FILE } from './agent-hub-orb-bot-preamble'
import {
  agentHubOrbAvatarColorUpdate,
  agentHubOrbTintAvatarColor
} from './agent-hub-orb-bot-settings'
import { getAgentHubOrbDirectory } from './agent-hub-orb-folder-path'
import { parseAgentHubOrbMemory } from './agent-hub-orb-identity-files'
import { agentHubOrbPermissionMode } from './agent-hub-orb-permission-settings'

const ORB_TEMPLATE = { id: 'hub-orb', skills: ['status-brief'] }
/** Left in the old Orb folder, which stays as a backup: the bot it moved to, and whether its files did. */
const MIGRATION_MARKER = 'migrated-to-bot'

type Marker = { botId: string; done: boolean }

export type AgentHubOrbBotDeps = {
  bots: Pick<BotController, 'list' | 'update' | 'endFirstRun'>
  /** Built on first use: making the bot needs the runtime's template and schedule deps. */
  createDeps: () => BotTemplateCreateDeps
  getSettings: () => AgentHubSettings
  botsRoot?: string
  legacyDirectory?: string
}

export function findAgentHubOrbBot(bots: readonly Bot[]): Bot | null {
  return bots.find((bot) => bot.role === 'orb') ?? null
}

/** Where SOUL.md, USER.md and MEMORY.md live: the Orb bot's home once it exists, else the Orb folder. */
export function agentHubOrbIdentityDirectory(bots: readonly Bot[], botsRoot?: string): string {
  const bot = findAgentHubOrbBot(bots)
  return bot ? botHomeFolder(bot, botsRoot) : getAgentHubOrbDirectory()
}

async function readMarker(directory: string): Promise<Marker | null> {
  try {
    const parsed: unknown = JSON.parse(
      await readFile(path.join(directory, MIGRATION_MARKER), 'utf8')
    )
    if (
      parsed &&
      typeof parsed === 'object' &&
      'botId' in parsed &&
      typeof parsed.botId === 'string'
    ) {
      return { botId: parsed.botId, done: 'done' in parsed && parsed.done === true }
    }
  } catch {
    // Missing or unreadable: nothing moved yet.
  }
  return null
}

async function writeMarker(directory: string, marker: Marker): Promise<void> {
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, MIGRATION_MARKER), `${JSON.stringify(marker)}\n`)
}

async function readText(file: string): Promise<string> {
  return readFile(file, 'utf8').catch(() => '')
}

/** The Orb's own `- [date] text` lines in a bot's `- date text` form, newest first as bots keep them. */
function botMemoryLines(orbMemory: string): string[] {
  return parseAgentHubOrbMemory(orbMemory)
    .map((entry) => (entry.date ? `- ${entry.date} ${entry.text}` : entry.line))
    .toReversed()
}

async function moveIdentityFiles(
  deps: AgentHubOrbBotDeps,
  bot: Bot,
  legacy: string
): Promise<void> {
  const home = botHomeFolder(bot, deps.botsRoot)
  const { name, tone } = normalizeAgentHubOrbIdentitySettings(deps.getSettings())
  const soul = (await readText(path.join(legacy, 'SOUL.md'))).trim()
  const seeded = soul || (tone === 'custom' ? '' : agentHubOrbSoulText(name, tone).trim())
  if (seeded) {
    await writeFile(path.join(home, 'SOUL.md'), `${seeded}\n`)
  }
  const user = await readText(path.join(legacy, 'USER.md'))
  if (user.trim()) {
    await writeFile(path.join(home, AGENT_HUB_ORB_BOT_USER_FILE), user)
  }
  const lines = botMemoryLines(await readText(path.join(legacy, 'MEMORY.md')))
  if (lines.length) {
    const memoryFile = path.join(home, 'MEMORY.md')
    const currentText = await readText(memoryFile)
    const have = new Set(currentText.split('\n'))
    const missing = lines.filter((line) => !have.has(line))
    if (missing.length) {
      await writeFile(memoryFile, `${currentText.replace(/\n*$/, '\n')}${missing.join('\n')}\n`)
    }
  }
}

/** The bot fields the Orb settings choose; a name another bot holds stays as it is. */
function settingsUpdates(
  bots: readonly Bot[],
  bot: Bot,
  settings: AgentHubSettings
): BotHostUpdates {
  const updates: BotHostUpdates = {}
  const { name, tint } = normalizeAgentHubOrbIdentitySettings(settings)
  const avatarColor = agentHubOrbAvatarColorUpdate(bot, tint)
  if (avatarColor) {
    updates.avatarColor = avatarColor
  }
  const taken = bots.some(
    (entry) => entry.id !== bot.id && entry.name.toLowerCase() === name.toLowerCase()
  )
  if (name !== bot.name && !taken) {
    updates.name = name
  }
  const chosen = normalizeAgentHubOrbSettings(settings)
  const agent = isBotAgent(chosen.agent) ? chosen.agent : bot.agent
  if (agent !== bot.agent) {
    updates.agent = agent
  }
  const mode = agentHubOrbPermissionMode(settings, agent) ?? undefined
  if (mode !== bot.permissionMode) {
    updates.permissionMode = mode ?? null
  }
  const model = chosen.model ?? undefined
  if (model !== bot.launch?.model || (updates.agent && bot.launch)) {
    updates.launch = model ? { model } : null
  }
  return updates
}

async function syncSettings(deps: AgentHubOrbBotDeps, bot: Bot): Promise<Bot> {
  const updates = settingsUpdates(deps.bots.list(), bot, deps.getSettings())
  return Object.keys(updates).length ? deps.bots.update(bot.id, updates) : bot
}

async function makeOrbBot(deps: AgentHubOrbBotDeps, legacy: string): Promise<Bot> {
  const marker = await readMarker(legacy)
  const halfMade = marker && deps.bots.list().find((bot) => bot.id === marker.botId)
  if (halfMade) {
    return halfMade
  }
  const settings = deps.getSettings()
  const chosen = normalizeAgentHubOrbSettings(settings)
  const agent = isBotAgent(chosen.agent) ? chosen.agent : 'claude'
  const mode = agentHubOrbPermissionMode(settings, agent)
  const { name, tint } = normalizeAgentHubOrbIdentitySettings(settings)
  const bot = await createBotFromTemplate(deps.createDeps(), {
    name,
    agent,
    avatarColor: agentHubOrbTintAvatarColor(tint),
    ...(mode ? { permissionMode: mode } : {}),
    ...(chosen.model ? { launch: { model: chosen.model } } : {}),
    fromTemplate: ORB_TEMPLATE
  })
  // Before the role, so an interrupted setup finds this bot again instead of making a second.
  await writeMarker(legacy, { botId: bot.id, done: false })
  return bot
}

async function ensureOnce(deps: AgentHubOrbBotDeps): Promise<Bot> {
  const legacy = deps.legacyDirectory ?? getAgentHubOrbDirectory()
  const existing = findAgentHubOrbBot(deps.bots.list())
  let bot = existing ?? (await makeOrbBot(deps, legacy))
  if (!existing) {
    bot = await deps.bots.update(bot.id, { role: 'orb' })
    // The Orb's setup is its migrated SOUL.md, so the first-run interview never starts.
    await deps.bots.endFirstRun(bot.id)
  }
  const marker = await readMarker(legacy)
  const moved = marker?.botId === bot.id && marker.done
  if (!moved && (!existing || marker?.botId === bot.id)) {
    await moveIdentityFiles(deps, bot, legacy)
    await writeMarker(legacy, { botId: bot.id, done: true })
  }
  return syncSettings(deps, bot)
}

let ensuring: Promise<Bot> | null = null

/** The Orb bot, made on first use and synced with the Orb settings; safe to call on every open. */
export function ensureAgentHubOrbBot(deps: AgentHubOrbBotDeps): Promise<Bot> {
  ensuring ??= ensureOnce(deps).finally(() => {
    ensuring = null
  })
  return ensuring
}

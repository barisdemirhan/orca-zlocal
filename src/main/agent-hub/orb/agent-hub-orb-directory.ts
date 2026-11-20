import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { AGENT_HUB_ORB_OPENING_PROMPT } from '../../../shared/agent-hub-orb'
import { normalizeAgentHubOrbIdentitySettings } from '../../../shared/agent-hub-orb-settings'
import type {
  AgentHubOrbMemoryEntry,
  AgentHubOrbTone
} from '../../../shared/agent-hub-orb-identity'
import type { AgentHubSettings } from '../../../shared/agent-hub-settings'
import { buildAgentHubOrbIdentityBlock } from './agent-hub-orb-identity-block'
import {
  readAgentHubOrbMemory,
  seedAgentHubOrbSoul,
  readAgentHubOrbSoul,
  readAgentHubOrbUser
} from './agent-hub-orb-identity-files'
import { getAgentHubOrbDirectory } from './agent-hub-orb-folder-path'

export { getAgentHubOrbDirectory }
// Why both names: Claude reads CLAUDE.md, Codex and Pi read AGENTS.md, each from the working folder.
export const AGENT_HUB_ORB_INSTRUCTION_FILES = ['CLAUDE.md', 'AGENTS.md'] as const

export type AgentHubOrbInstructionsOptions = {
  name?: string
  tone?: AgentHubOrbTone
  soul?: string
  user?: string
  memory?: readonly AgentHubOrbMemoryEntry[]
  memorySuggestions?: boolean
}

function buildInstructions(options: AgentHubOrbInstructionsOptions): {
  markdown: string
  truncated: boolean
} {
  const identity = buildAgentHubOrbIdentityBlock({
    name: options.name ?? 'Orb',
    soul: options.soul ?? '',
    user: options.user ?? '',
    memory: options.memory ?? [],
    memorySuggestions: options.memorySuggestions ?? false
  })
  const header = `<!-- Orca rewrites this file whenever Orb opens. -->\n# Orb\n\n${AGENT_HUB_ORB_OPENING_PROMPT}\n`
  return {
    markdown: identity.text ? `${header}\n${identity.text}\n` : header,
    truncated: identity.truncated
  }
}

type IdentityOptions = Pick<AgentHubOrbInstructionsOptions, 'name' | 'tone' | 'memorySuggestions'>

export function agentHubOrbInstructionsMarkdown(
  options: AgentHubOrbInstructionsOptions = {}
): string {
  return buildInstructions(options).markdown
}

export function agentHubOrbIdentityOptions(settings: AgentHubSettings): IdentityOptions {
  const { name, tone, memorySuggestions } = normalizeAgentHubOrbIdentitySettings(settings)
  return { name, tone, memorySuggestions }
}

async function readInstructions(
  directory: string,
  options: AgentHubOrbInstructionsOptions
): Promise<{ markdown: string; truncated: boolean }> {
  const [soul, user, memory] = await Promise.all([
    readAgentHubOrbSoul(directory),
    readAgentHubOrbUser(directory),
    readAgentHubOrbMemory(directory)
  ])
  return buildInstructions({ ...options, soul, user, memory })
}

/** Rewrites CLAUDE.md and AGENTS.md from the identity files; the single place both are produced. */
export async function refreshAgentHubOrbInstructions(
  directory = getAgentHubOrbDirectory(),
  options: IdentityOptions = {}
): Promise<{ truncated: boolean }> {
  await mkdir(directory, { recursive: true })
  if (options.tone) {
    await seedAgentHubOrbSoul(options.name ?? 'Orb', options.tone, directory)
  }
  const { markdown, truncated } = await readInstructions(directory, options)
  await Promise.all(
    AGENT_HUB_ORB_INSTRUCTION_FILES.map(async (name) => {
      const file = path.join(directory, name)
      if ((await readFile(file, 'utf8').catch(() => null)) !== markdown) {
        await writeFile(file, markdown)
      }
    })
  )
  return { truncated }
}

/** Creates the folder and refreshes its instruction files, so a prompt change reaches the agent
 *  on its next start without a visible message. Returns the canonical path a session records. */
export async function ensureAgentHubOrbDirectory(
  directory = getAgentHubOrbDirectory(),
  options: IdentityOptions = {}
): Promise<string> {
  await refreshAgentHubOrbInstructions(directory, options)
  return realpath(directory)
}

/** Whether a session launched in the Orb folder, where the files above stand in for a prompt. */
export function isAgentHubOrbDirectory(
  launchDirectory: string | undefined,
  orbDirectory: string
): boolean {
  return launchDirectory !== undefined && path.resolve(launchDirectory) === orbDirectory
}

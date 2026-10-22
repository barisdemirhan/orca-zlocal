import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getAppEnvironment } from '../../../shared/app-environment'
import { AGENT_HUB_ORB_OPENING_PROMPT } from '../../../shared/agent-hub-orb'

const ORB_DIRNAME = 'orb'
// Why both names: Claude reads CLAUDE.md, Codex and Pi read AGENTS.md, each from the working folder.
export const AGENT_HUB_ORB_INSTRUCTION_FILES = ['CLAUDE.md', 'AGENTS.md'] as const

export function agentHubOrbInstructionsMarkdown(): string {
  return `<!-- Orca rewrites this file whenever Orb opens. -->\n# Orb\n\n${AGENT_HUB_ORB_OPENING_PROMPT}\n`
}

/** The app-owned folder Orb runs in; a desktop-only root, like the floating workspace. */
export function getAgentHubOrbDirectory(): string {
  return path.join(getAppEnvironment().getPath('userData'), ORB_DIRNAME)
}

/** Creates the folder and refreshes its instruction files, so a prompt change reaches the agent
 *  on its next start without a visible message. Returns the canonical path a session records. */
export async function ensureAgentHubOrbDirectory(
  directory = getAgentHubOrbDirectory()
): Promise<string> {
  await mkdir(directory, { recursive: true })
  const content = agentHubOrbInstructionsMarkdown()
  await Promise.all(
    AGENT_HUB_ORB_INSTRUCTION_FILES.map(async (name) => {
      const file = path.join(directory, name)
      if ((await readFile(file, 'utf8').catch(() => null)) !== content) {
        await writeFile(file, content)
      }
    })
  )
  return realpath(directory)
}

/** Whether a session launched in the Orb folder, where the files above stand in for a prompt. */
export function isAgentHubOrbDirectory(
  launchDirectory: string | undefined,
  orbDirectory: string
): boolean {
  return launchDirectory !== undefined && path.resolve(launchDirectory) === orbDirectory
}

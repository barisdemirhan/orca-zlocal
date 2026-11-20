import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  agentHubOrbSoulText,
  type AgentHubOrbMemoryEntry,
  type AgentHubOrbTone
} from '../../../shared/agent-hub-orb-identity'
import { getAgentHubOrbDirectory } from './agent-hub-orb-folder-path'

export type { AgentHubOrbMemoryEntry }

const SOUL_FILE = 'SOUL.md'
const USER_FILE = 'USER.md'
const MEMORY_FILE = 'MEMORY.md'
const MEMORY_HEADING = '# Memory'
const DATED_ENTRY = /^- \[(\d{4}-\d{2}-\d{2})\]\s*(.*)$/

async function readText(directory: string, name: string): Promise<string> {
  return readFile(path.join(directory, name), 'utf8').catch(() => '')
}

async function writeText(directory: string, name: string, content: string): Promise<void> {
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, name), content)
}

export function readAgentHubOrbSoul(directory = getAgentHubOrbDirectory()): Promise<string> {
  return readText(directory, SOUL_FILE)
}

export function writeAgentHubOrbSoul(
  text: string,
  directory = getAgentHubOrbDirectory()
): Promise<void> {
  return writeText(directory, SOUL_FILE, text)
}

/** Writes the tone preset when SOUL.md was never created; an emptied file stays empty. */
export async function seedAgentHubOrbSoul(
  name: string,
  tone: AgentHubOrbTone,
  directory = getAgentHubOrbDirectory()
): Promise<void> {
  if (tone === 'custom') {
    return
  }
  const missing = await readFile(path.join(directory, SOUL_FILE), 'utf8').then(
    () => false,
    () => true
  )
  if (missing) {
    await writeText(directory, SOUL_FILE, agentHubOrbSoulText(name, tone))
  }
}

export function readAgentHubOrbUser(directory = getAgentHubOrbDirectory()): Promise<string> {
  return readText(directory, USER_FILE)
}

export function writeAgentHubOrbUser(
  text: string,
  directory = getAgentHubOrbDirectory()
): Promise<void> {
  return writeText(directory, USER_FILE, text)
}

export function parseAgentHubOrbMemory(content: string): AgentHubOrbMemoryEntry[] {
  return content
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => {
      const dated = DATED_ENTRY.exec(line)
      return dated
        ? { line, text: dated[2], date: dated[1] }
        : { line, text: line.slice(2).trim(), date: null }
    })
}

export async function readAgentHubOrbMemory(
  directory = getAgentHubOrbDirectory()
): Promise<AgentHubOrbMemoryEntry[]> {
  return parseAgentHubOrbMemory(await readText(directory, MEMORY_FILE))
}

function isoDay(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export async function appendAgentHubOrbMemory(
  text: string,
  date: Date,
  directory = getAgentHubOrbDirectory()
): Promise<void> {
  const entry = `- [${isoDay(date)}] ${text.replace(/\s+/g, ' ').trim()}`
  const existing = await readText(directory, MEMORY_FILE)
  const base = existing.trim() ? existing.replace(/\n*$/, '\n') : `${MEMORY_HEADING}\n\n`
  await writeText(directory, MEMORY_FILE, `${base}${entry}\n`)
}

/** Removes the first line equal to `line`, or every entry line when `line` is null. */
export async function forgetAgentHubOrbMemory(
  line: string | null,
  directory = getAgentHubOrbDirectory()
): Promise<void> {
  const existing = await readText(directory, MEMORY_FILE)
  if (!existing) {
    return
  }
  const lines = existing.split('\n')
  let removed = false
  const kept = lines.filter((candidate) => {
    if (!candidate.startsWith('- ')) {
      return true
    }
    if (line === null) {
      return false
    }
    if (!removed && candidate === line) {
      removed = true
      return false
    }
    return true
  })
  await writeText(directory, MEMORY_FILE, kept.join('\n'))
}

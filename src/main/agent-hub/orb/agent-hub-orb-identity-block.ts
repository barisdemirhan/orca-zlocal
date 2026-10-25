import {
  AGENT_HUB_ORB_MEMORY_MAX_LENGTH,
  type AgentHubOrbMemoryEntry
} from '../../../shared/agent-hub-orb-identity'

export const AGENT_HUB_ORB_IDENTITY_BLOCK_LIMIT = 6000

export type AgentHubOrbIdentityInput = {
  name: string
  soul: string
  user: string
  memory: readonly AgentHubOrbMemoryEntry[]
  memorySuggestions: boolean
}

function suggestionLine(): string {
  return `Propose a lasting fact about the user or their work with \`orca hub orb remember "<text>"\` (${AGENT_HUB_ORB_MEMORY_MAX_LENGTH} characters at most); never edit MEMORY.md yourself. When a memory shapes a decision, say so in one line.`
}

function render(
  input: AgentHubOrbIdentityInput,
  soul: string,
  user: string,
  memory: readonly AgentHubOrbMemoryEntry[]
): string {
  const sections = [`## Identity\n\nYour name is ${input.name}.${soul ? `\n\n${soul}` : ''}`]
  if (user) {
    sections.push(`## About the user\n\n${user}`)
  }
  if (memory.length > 0) {
    sections.push(`## Memory\n\n${memory.map((entry) => entry.line).join('\n')}`)
  }
  if (input.memorySuggestions) {
    sections.push(suggestionLine())
  }
  return sections.join('\n\n')
}

/** The Identity block of the generated instruction files, capped by dropping the oldest memories,
 *  then USER, then SOUL; empty when there is nothing to add. */
export function buildAgentHubOrbIdentityBlock(
  input: AgentHubOrbIdentityInput,
  limit = AGENT_HUB_ORB_IDENTITY_BLOCK_LIMIT
): { text: string; truncated: boolean } {
  let soul = input.soul.trim()
  let user = input.user.trim()
  let memory = [...input.memory]
  if (!soul && !user && memory.length === 0 && !input.memorySuggestions && input.name === 'Orb') {
    return { text: '', truncated: false }
  }
  let truncated = false
  while (render(input, soul, user, memory).length > limit && memory.length > 0) {
    memory = memory.slice(1)
    truncated = true
  }
  const fits = (): boolean => render(input, soul, user, memory).length <= limit
  for (const field of ['user', 'soul'] as const) {
    if (fits()) {
      break
    }
    const current = field === 'user' ? user : soul
    const excess = render(input, soul, user, memory).length - limit
    const cut = current.slice(0, Math.max(0, current.length - excess)).trimEnd()
    if (field === 'user') {
      user = cut
    } else {
      soul = cut
    }
    truncated = true
  }
  return { text: render(input, soul, user, memory), truncated }
}

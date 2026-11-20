export const AGENT_HUB_ORB_DEFAULT_NAME = 'Orb'
export const AGENT_HUB_ORB_NAME_MAX_LENGTH = 24
export const AGENT_HUB_ORB_MEMORY_MAX_LENGTH = 280

export const AGENT_HUB_ORB_TONES = ['calm', 'brief', 'warm', 'mentor', 'custom'] as const
export type AgentHubOrbTone = (typeof AGENT_HUB_ORB_TONES)[number]

export const AGENT_HUB_ORB_TINTS = ['silver', 'teal', 'emerald', 'violet', 'rose'] as const
export type AgentHubOrbTint = (typeof AGENT_HUB_ORB_TINTS)[number]

const TONE_TEXT: Record<Exclude<AgentHubOrbTone, 'custom'>, string> = {
  calm: 'Speak calmly and plainly. Short sentences, no hype.\nAnswer the question first, then the detail.',
  brief:
    'Be terse. One or two sentences unless asked for more.\nLists over paragraphs. No pleasantries.',
  warm: 'Be warm and encouraging, but never vague.\nAcknowledge effort briefly, then give the facts.',
  mentor: 'Explain the why behind each step.\nPoint out one better habit when you see it, kindly.'
}

export function normalizeAgentHubOrbName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim().slice(0, AGENT_HUB_ORB_NAME_MAX_LENGTH) : ''
  return name || AGENT_HUB_ORB_DEFAULT_NAME
}

export function normalizeAgentHubOrbTone(value: unknown): AgentHubOrbTone {
  return AGENT_HUB_ORB_TONES.find((tone) => tone === value) ?? 'calm'
}

export function normalizeAgentHubOrbTint(value: unknown): AgentHubOrbTint {
  return AGENT_HUB_ORB_TINTS.find((tint) => tint === value) ?? 'silver'
}

/** The SOUL.md text a tone preset writes; custom keeps whatever the user typed. */
export function agentHubOrbSoulText(
  name: string,
  tone: Exclude<AgentHubOrbTone, 'custom'>
): string {
  return `# ${name}\n\nYou are ${name}, the user's companion in Orca.\n${TONE_TEXT[tone]}\nReply in the user's language.`
}

export type AgentHubOrbMemoryEntry = { line: string; text: string; date: string | null }

export type AgentHubOrbIdentityFiles = {
  soul: string
  user: string
  memory: AgentHubOrbMemoryEntry[]
  truncated: boolean
}

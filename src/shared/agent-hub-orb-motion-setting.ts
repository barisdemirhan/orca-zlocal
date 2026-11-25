export const AGENT_HUB_ORB_MOTIONS = ['full', 'calm', 'off'] as const
export type AgentHubOrbMotion = (typeof AGENT_HUB_ORB_MOTIONS)[number]

export function normalizeAgentHubOrbMotion(value: unknown): AgentHubOrbMotion {
  return AGENT_HUB_ORB_MOTIONS.find((motion) => motion === value) ?? 'full'
}

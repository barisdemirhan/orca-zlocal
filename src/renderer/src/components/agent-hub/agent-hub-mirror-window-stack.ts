import type {
  AgentHubMirrorChip,
  AgentHubMirrorState,
  AgentHubMirrorWindowState
} from './agent-hub-mirror-membership'
export const AGENT_HUB_MIRROR_CHIP_CAP = 12
export function parkAgentHubMirrorWindow(
  chips: readonly AgentHubMirrorChip[],
  window: AgentHubMirrorWindowState
): AgentHubMirrorChip[] {
  return [
    ...chips.filter((chip) => chip.window.id !== window.id),
    { window, minimizedAt: Date.now() }
  ].slice(-AGENT_HUB_MIRROR_CHIP_CAP)
}
export function raiseAgentHubMirrorWindow(
  current: AgentHubMirrorState,
  window: AgentHubMirrorWindowState,
  windowCap: number
): AgentHubMirrorState {
  const windows = [...current.windows.filter((open) => open.id !== window.id), window]
  let chips = current.chips.filter((chip) => chip.window.id !== window.id)
  while (windows.length > windowCap) {
    const evicted = windows.shift()
    if (evicted) {
      chips = parkAgentHubMirrorWindow(chips, evicted)
    }
  }
  return { windows, chips }
}

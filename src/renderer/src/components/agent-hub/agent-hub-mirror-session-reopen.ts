import { AGENT_HUB_MIRROR_CHIP_CAP } from './agent-hub-mirror-window-stack'
import type { AgentHubMirrorGeometry } from './agent-hub-mirror-geometry'
import {
  agentHubMirrorWindows,
  homeAgentHubMirrorTab,
  orderAgentHubMirrorTabs,
  agentHubMirrorSourceKey,
  AGENT_HUB_MIRROR_ENTRY_CAP,
  type AgentHubMirrorChip,
  type AgentHubMirrorState,
  type AgentHubMirrorWindowState
} from './agent-hub-mirror-membership'
import { keepAgentHubMirrorPlace, rememberAgentHubMirrorOrigin } from './agent-hub-mirror-places'
export type AgentHubReopenedMirror = {
  window: AgentHubMirrorWindowState
  minimized: boolean
  minimizedAt: number
  place: { geometry: AgentHubMirrorGeometry; kept: boolean } | null
}
export function reopenAgentHubMirrorState(
  state: AgentHubMirrorState,
  saved: readonly AgentHubReopenedMirror[],
  windowCap: number,
  park: (
    chips: readonly AgentHubMirrorChip[],
    window: AgentHubMirrorWindowState
  ) => AgentHubMirrorChip[]
): AgentHubMirrorState | null {
  const present = new Set(
    agentHubMirrorWindows(state).flatMap((window) =>
      window.tabs.flatMap((tab) =>
        (tab.viewing ? [tab.target, tab.viewing] : [tab.target]).map(agentHubMirrorSourceKey)
      )
    )
  )
  const ids = new Set(agentHubMirrorWindows(state).map((window) => window.id))
  const entryIds = new Set(
    agentHubMirrorWindows(state).flatMap((window) => window.tabs.map((tab) => tab.id))
  )
  const fresh: AgentHubReopenedMirror[] = []
  let entries = entryIds.size
  for (const mirror of saved.slice(0, 32)) {
    if (ids.has(mirror.window.id)) {
      continue
    }
    const tabs = mirror.window.tabs.slice(0, 10).filter((tab) => {
      const key = agentHubMirrorSourceKey(tab.target)
      if (present.has(key) || entryIds.has(tab.id) || entries >= AGENT_HUB_MIRROR_ENTRY_CAP) {
        return false
      }
      entryIds.add(tab.id)
      present.add(key)
      entries++
      return true
    })
    const homeTabs = orderAgentHubMirrorTabs(tabs.map(homeAgentHubMirrorTab))
    const first = homeTabs[0]
    if (!first) {
      continue
    }
    ids.add(mirror.window.id)
    const window = {
      ...mirror.window,
      tabs: homeTabs,
      activeTabId: tabs.some((tab) => tab.id === mirror.window.activeTabId)
        ? mirror.window.activeTabId
        : first.id
    }
    fresh.push({ ...mirror, window })
    if (mirror.place) {
      rememberAgentHubMirrorOrigin(window.id, mirror.place.geometry)
      if (mirror.place.kept) {
        keepAgentHubMirrorPlace(window.id)
      }
    }
  }
  if (!fresh.length) {
    return null
  }
  const windows = [
    ...fresh.filter((mirror) => !mirror.minimized).map((mirror) => mirror.window),
    ...state.windows
  ]
  let chips = [
    ...fresh
      .filter((mirror) => mirror.minimized)
      .map(({ window, minimizedAt }) => ({ window, minimizedAt })),
    ...state.chips
  ]
  for (const evicted of windows.splice(0, Math.max(0, windows.length - windowCap))) {
    chips = park(chips, evicted)
  }
  return { windows, chips: chips.slice(-AGENT_HUB_MIRROR_CHIP_CAP) }
}

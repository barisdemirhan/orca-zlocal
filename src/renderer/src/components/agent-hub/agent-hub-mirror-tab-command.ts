import { readAgentHubMirrors } from './agent-hub-mirror-store'
import { agentHubMirrorWindowIdOf } from './agent-hub-mirror-element'
import { activateAgentHubMirrorTab } from './agent-hub-mirror-tab-operations'
import { agentHubMirrorTabId } from './AgentHubMirrorTabStrip'

export function agentHubMirrorTabCommandAvailable(): boolean {
  const active = document.activeElement
  if (
    !(active instanceof HTMLElement) ||
    active.closest(
      '.xterm, input, textarea, [contenteditable="true"], [role="menu"], [data-agent-hub-picker]'
    )
  ) {
    return false
  }
  const key = agentHubMirrorWindowIdOf(active)
  return readAgentHubMirrors().windows.some((window) => window.id === key && window.tabs.length > 1)
}

export function cycleAgentHubMirrorTab(direction: 1 | -1): void {
  if (!agentHubMirrorTabCommandAvailable()) {
    return
  }
  const active = document.activeElement
  const key = active instanceof HTMLElement ? agentHubMirrorWindowIdOf(active) : null
  const window = readAgentHubMirrors().windows.find((window) => window.id === key)
  if (!window) {
    return
  }
  const index = window.tabs.findIndex((tab) => tab.id === window.activeTabId)
  const next = window.tabs[(index + direction + window.tabs.length) % window.tabs.length]
  if (next && activateAgentHubMirrorTab(window.id, next.id, false).status === 'changed') {
    document.getElementById(agentHubMirrorTabId(next.id))?.focus({ preventScroll: true })
  }
}

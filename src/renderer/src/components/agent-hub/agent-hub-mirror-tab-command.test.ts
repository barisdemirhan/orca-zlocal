/** @vitest-environment happy-dom */
import { afterEach, expect, it, vi } from 'vitest'
import { makeTabWithIds, makeWorktree } from './agent-hub-activity-test-fixtures'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import type * as MirrorSource from './agent-hub-mirror-source'
import {
  agentHubMirrorTabCommandAvailable,
  cycleAgentHubMirrorTab
} from './agent-hub-mirror-tab-command'
import { addAgentHubMirrorTab } from './agent-hub-mirror-tab-operations'
import {
  openAgentHubMirror,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest
} from './agent-hub-mirror-store'
import { KEYBINDING_DEFINITION_CORE_4 } from '../../../../shared/keybindings/definitions-core-4'
vi.mock('./agent-hub-mirror-source', async (original) => ({
  ...(await original<typeof MirrorSource>()),
  resolveAgentHubMirrorTarget: (target: AgentHubPaneTarget) => target
}))
afterEach(() => {
  document.body.replaceChildren()
  resetAgentHubMirrorsForTest()
})
function target(id: string): AgentHubPaneTarget {
  const worktree = makeWorktree()
  return {
    worktree,
    repo: null,
    tab: makeTabWithIds(id, worktree.id),
    paneKey: null,
    title: id,
    agentType: null
  }
}
it('ships both commands unbound and does not cycle an ordinary terminal outside mirrors', () => {
  for (const id of ['agentHub.nextMirrorTab', 'agentHub.previousMirrorTab']) {
    const definition = KEYBINDING_DEFINITION_CORE_4.find((item) => item.id === id)
    expect(definition?.defaultBindings).toEqual({ darwin: [], linux: [], win32: [] })
  }
  const input = document.createElement('textarea')
  input.className = 'xterm-helper-textarea'
  const xterm = document.createElement('div')
  xterm.className = 'xterm'
  xterm.append(input)
  document.body.append(xterm)
  input.focus()
  expect(agentHubMirrorTabCommandAvailable()).toBe(false)
})
it('cycles only a mirror with chrome focus and wraps without affecting another window', () => {
  openAgentHubMirror(target('a'))
  const window = readAgentHubMirrors().windows[0]
  if (!window) {
    throw new Error('No window')
  }
  addAgentHubMirrorTab(window.id, target('b'))
  const section = document.createElement('section')
  section.dataset.agentHubMirror = ''
  section.dataset.agentHubMirrorKey = window.id
  const chrome = document.createElement('button')
  section.append(chrome)
  document.body.append(section)
  chrome.focus()
  expect(agentHubMirrorTabCommandAvailable()).toBe(true)
  cycleAgentHubMirrorTab(1)
  expect(readAgentHubMirrors().windows[0]?.activeTabId).toBe(window.activeTabId)
  cycleAgentHubMirrorTab(-1)
  expect(readAgentHubMirrors().windows[0]?.activeTabId).not.toBe(window.activeTabId)
})

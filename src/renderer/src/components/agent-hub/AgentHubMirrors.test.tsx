/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AgentHubMirrors } from './AgentHubMirrors'
import { EMPTY_AGENT_HUB_LINEAGE } from './agent-hub-lineage'
import type * as MirrorSource from './agent-hub-mirror-source'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import {
  openAgentHubMirror,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest
} from './agent-hub-mirror-store'
import { toggleAgentHubMirrorTabPin } from './agent-hub-mirror-tab-operations'
import { makeTabWithIds, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({
      settings: {},
      activeView: 'terminal',
      activeWorktreeId: null,
      tabsByWorktree: {},
      unifiedTabsByWorktree: {},
      terminalLayoutsByTabId: {},
      ptyIdsByTabId: {},
      sleepingAgentSessionsByPaneKey: {},
      agentStatusByPaneKey: {},
      dictationState: 'idle'
    }))
  }
})
vi.mock('./agent-hub-mirror-source', async (importOriginal) => ({
  ...(await importOriginal<typeof MirrorSource>()),
  resolveAgentHubMirrorTarget: (target: AgentHubPaneTarget) => target
}))
vi.mock('./use-agent-hub-live-pty', () => ({ useAgentHubLivePty: () => null }))
vi.mock('./use-mirror-window-geometry', async () => {
  const { useRef } = await import('react')
  return {
    useMirrorWindowGeometry: () => ({
      geometry: { x: 0, y: 0, width: 480, height: 300 },
      focus: null,
      settling: false,
      sectionRef: useRef(null),
      beginDrag: vi.fn(),
      onPointerMove: vi.fn(),
      endDrag: vi.fn(),
      cancelDrag: vi.fn()
    })
  }
})
vi.mock('./AgentHubMirrorTabStrip', () => ({
  AgentHubMirrorTabStrip: () => null,
  agentHubMirrorPanelId: (id: string) => id,
  agentHubMirrorTabId: (id: string) => id
}))
vi.mock('./AgentHubMirrorHeaderControls', () => ({
  AgentHubMirrorHeaderControls: ({ onReveal }: { onReveal: () => void }) => (
    <button onClick={onReveal}>Jump</button>
  )
}))
vi.mock('./AgentHubMirrorDictationOverlay', () => ({ AgentHubMirrorDictationOverlay: () => null }))
vi.mock('./AgentHubMirrorPreviews', () => ({ AgentHubMirrorPreviews: () => null }))
vi.mock('./AgentHubMirrorChip', () => ({ AgentHubMirrorChip: () => <span>Minimized mirror</span> }))
vi.mock('../browser-pane/host-guest/webview-registry', () => ({
  acquireWebviewsDragPassthrough: () => () => {}
}))

afterEach(() => {
  cleanup()
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

function Mirrors({
  onReveal = vi.fn()
}: {
  onReveal?: (target: AgentHubPaneTarget) => void
}): React.JSX.Element {
  return (
    <AgentHubMirrors
      hidden={false}
      onCanvas={false}
      hubRef={{ current: null }}
      trayRef={{ current: null }}
      traySide="top"
      trayAlertSide="top"
      trayHidden={false}
      hubOpen={false}
      trayPeekMs={0}
      threads={[]}
      lineage={EMPTY_AGENT_HUB_LINEAGE}
      alerts={[]}
      locationOf={() => ({ group: null, project: 'Workspace', workspace: null })}
      requestPresentationOf={() => ({
        title: 'Caller',
        targetTitle: 'Target',
        location: { group: null, project: 'Workspace', workspace: null },
        target: null
      })}
      onReveal={onReveal}
      onOpenCard={vi.fn()}
    />
  )
}

it.each([false, true])('Jump navigates while preserving a pinned tab (%s)', (pinned) => {
  const source = target('first')
  openAgentHubMirror(source)
  const window = readAgentHubMirrors().windows[0]
  if (!window) {
    throw new Error('No mirror')
  }
  if (pinned) {
    toggleAgentHubMirrorTabPin(window.id, window.activeTabId)
  }
  const reveal = vi.fn()
  render(<Mirrors onReveal={reveal} />)
  fireEvent.click(screen.getByRole('button', { name: 'Jump' }))
  expect(reveal).toHaveBeenCalledWith(source, null)
  expect(readAgentHubMirrors().windows).toHaveLength(pinned ? 1 : 0)
  if (pinned) {
    expect(readAgentHubMirrors().windows[0]?.tabs[0]).toMatchObject({
      id: window.activeTabId,
      target: source,
      isPinned: true
    })
  }
})

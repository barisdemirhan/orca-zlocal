/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AgentHubMirrors } from './AgentHubMirrors'
import { AgentHubWorkspaceFocusShade } from './AgentHubMirrorFocusShade'
import { EMPTY_AGENT_HUB_LINEAGE } from './agent-hub-lineage'
import type * as MirrorSource from './agent-hub-mirror-source'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import {
  minimizeAgentHubMirror,
  openAgentHubMirror,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest
} from './agent-hub-mirror-store'
import { setAgentHubMirrorFocus } from './agent-hub-mirror-focus'
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
      terminalLayoutsByTabId: {},
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

function mirrorsLayer(): HTMLElement {
  const layer = document.querySelector<HTMLElement>('[data-agent-hub-mirrors]')
  if (!layer) {
    throw new Error('Mirrors layer is missing')
  }
  return layer
}

function Stage({ shade = false }: { shade?: boolean }): React.JSX.Element {
  return (
    <>
      <Mirrors />
      {shade ? <AgentHubWorkspaceFocusShade /> : null}
    </>
  )
}

it('keeps mirrors below the floating workspace without a panel click and after mirror use', () => {
  openAgentHubMirror(target('first'))
  openAgentHubMirror(target('second'))
  const view = render(<Stage />)
  const layer = mirrorsLayer()
  // The panel opens without pointer/focus events, as a shortcut with no terminal to focus can do.
  const panel = document.createElement('div')
  panel.dataset.floatingTerminalPanel = ''
  document.body.append(panel)
  try {
    expect(layer.classList.contains('z-[44]')).toBe(true)
    const first = screen.getByRole('dialog', { name: 'first' })
    const second = screen.getByRole('dialog', { name: 'second' })
    expect(Number(first.style.zIndex)).toBeLessThan(Number(second.style.zIndex))
    fireEvent.pointerDown(first)
    expect(Number(first.style.zIndex)).toBeGreaterThan(Number(second.style.zIndex))
    expect(screen.getByRole('dialog', { name: 'first' })).toBe(first)
    expect(mirrorsLayer()).toBe(layer)
    expect(layer.classList.contains('z-[44]')).toBe(true)

    fireEvent.pointerDown(panel)
    fireEvent.pointerDown(second)
    expect(Number(second.style.zIndex)).toBeGreaterThan(Number(first.style.zIndex))
    expect(layer.classList.contains('z-[44]')).toBe(true)
    act(() => openAgentHubMirror(target('third')))
    expect(screen.getAllByRole('dialog')).toHaveLength(3)
    expect(layer.classList.contains('z-[44]')).toBe(true)
  } finally {
    view.unmount()
    panel.remove()
  }
})

it('raises focused mirrors and their late shade above the floating workspace', () => {
  openAgentHubMirror(target('first'))
  openAgentHubMirror(target('second'))
  const view = render(<Stage />)
  const layer = mirrorsLayer()
  act(() => minimizeAgentHubMirror(readAgentHubMirrors().windows[0]!.id))
  const tray = screen.getByText('Minimized mirror').closest('[data-agent-hub-mirror-tray]')
  expect(tray?.parentElement).toBe(document.body)
  expect(tray?.classList.contains('z-[47]')).toBe(true)
  // Leaving the canvas mounts this portal after the already-mounted mirrors.
  view.rerender(<Stage shade />)
  expect(mirrorsLayer()).toBe(layer)
  act(() => setAgentHubMirrorFocus(readAgentHubMirrors().windows[0]!.id))
  const shade = document.querySelector('[data-agent-hub-focus-shade="workspace"]')
  expect(shade?.getAttribute('data-shown')).toBe('true')
  expect(layer.getAttribute('data-focused')).toBe('true')
  expect(layer.classList.contains('data-[focused=true]:z-[47]')).toBe(true)
  expect(shade?.classList.contains('data-[agent-hub-focus-shade=workspace]:z-[46]')).toBe(true)
  if (!shade) {
    throw new Error('Workspace focus shade is missing')
  }
  expect(layer.compareDocumentPosition(shade) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  fireEvent.pointerDown(shade)
  expect(shade.getAttribute('data-shown')).toBe('false')
  expect(layer.getAttribute('data-focused')).toBe('false')
})

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

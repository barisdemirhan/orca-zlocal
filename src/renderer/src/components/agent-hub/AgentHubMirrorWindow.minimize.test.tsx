import { acceptedAgentStatuses } from '@/store/slices/agent-status/accepted-agent-statuses'
import type * as MirrorSource from './agent-hub-mirror-source'
import { shownAgentHubMirrorTarget, activeAgentHubMirrorTab } from './agent-hub-mirror-membership'
/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '../ui/tooltip'
import { makeTabWithIds, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { AgentHubMirrorWindow } from './AgentHubMirrorWindow'
import { AgentHubMirrorTabStrip } from './AgentHubMirrorTabStrip'
import { EMPTY_AGENT_HUB_LINEAGE } from './agent-hub-lineage'
import { addAgentHubMirrorTab } from './agent-hub-mirror-tab-operations'
import {
  readAgentHubMirrors,
  minimizeAgentHubMirror,
  closeAgentHubMirror,
  openAgentHubMirror,
  resetAgentHubMirrorsForTest,
  useAgentHubMirrors
} from './agent-hub-mirror-store'
import { toggleAgentHubMirrorViewing } from './agent-hub-mirror-viewing'
import { requestAgentHubMirrorsDock } from './agent-hub-mirror-signals'
import { flyMirrorWindowToHub } from './mirror-window-flight'

const closeAgent = vi.hoisted(() => vi.fn())
vi.mock('./agent-hub-close-agent', () => ({ closeAgentHubAgent: closeAgent }))

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({
      settings: {},
      keybindings: {},
      tabsByWorktree: {},
      unifiedTabsByWorktree: {},
      terminalLayoutsByTabId: {},
      ptyIdsByTabId: {},
      sleepingAgentSessionsByPaneKey: {},
      agentStatusByPaneKey: acceptedAgentStatuses()
    }))
  }
})
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
      endDrag: vi.fn()
    })
  }
})
vi.mock('./AgentHubMirrorMicButton', () => ({
  AgentHubMirrorMicButton: ({ target }: { target: AgentHubPaneTarget }) => (
    <output data-mic-tab={target.tab.id} />
  )
}))
vi.mock('./AgentHubDimToggle', () => ({ AgentHubDimToggle: () => null }))
vi.mock('./AgentHubMirrorFocusButton', () => ({ AgentHubMirrorFocusButton: () => null }))
vi.mock('./AgentHubMirrorFocusShade', () => ({ AgentHubMirrorFocusShade: () => null }))
vi.mock('./AgentHubMirrorAddButton', () => ({
  AgentHubMirrorAddButton: () => <button>Add terminal</button>
}))

afterEach(() => {
  cleanup()
  resetAgentHubMirrorsForTest()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.useRealTimers()
})

// A closed menu restores focus on a 0ms timer, which would dismiss a menu opened before it fires.
const settleClosedMenu = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

function target(id: string): AgentHubPaneTarget {
  const worktree = makeWorktree()
  return {
    worktree,
    repo: null,
    tab: makeTabWithIds(id, worktree.id),
    paneKey: `${id}:leaf`,
    title: id,
    agentType: null
  }
}

function renderMinimizeStage(alones: boolean[]): void {
  function Stage(): React.JSX.Element {
    const { windows, chips } = useAgentHubMirrors()
    return (
      <TooltipProvider>
        {windows.map((entry) => (
          <AgentHubMirrorWindow
            key={entry.id}
            windowId={entry.id}
            tabStrip={<span />}
            target={activeAgentHubMirrorTab(entry).target}
            shownTarget={shownAgentHubMirrorTarget(activeAgentHubMirrorTab(entry))}
            thread={null}
            stackIndex={1}
            besideHubPanel={false}
            surface="in-workspace"
            nudge={null}
            onNudged={vi.fn()}
            family={null}
            locationOf={() => ({ group: null, project: 'Workspace', workspace: null })}
            familyActionsFor={() => ({})}
            onRetarget={vi.fn()}
            hubRef={{ current: null }}
            onSlot={vi.fn()}
            onFocus={vi.fn()}
            onClose={vi.fn()}
            onMinimize={(alone) => {
              alones.push(alone)
              minimizeAgentHubMirror(entry.id)
            }}
            onReveal={vi.fn()}
          />
        ))}
        {chips.map((chip) => (
          <span key={chip.window.id} data-chip>
            {activeAgentHubMirrorTab(chip.window).target.title} chip
          </span>
        ))}
      </TooltipProvider>
    )
  }
  render(<Stage />)
}

it('clicks each real header minimize button into its own chip when animation cannot run', () => {
  vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(() => {
    throw new TypeError('Animation unavailable')
  })
  openAgentHubMirror(target('first'))
  openAgentHubMirror(target('second'))
  const alones: boolean[] = []
  renderMinimizeStage(alones)
  fireEvent.click(screen.getAllByRole('button', { name: 'Minimize' })[0])
  expect(screen.getByText('first chip')).toBeDefined()
  fireEvent.click(screen.getAllByRole('button', { name: 'Minimize' })[0])
  expect(screen.getByText('second chip')).toBeDefined()
  expect(screen.queryAllByRole('dialog')).toHaveLength(0)
  // One window at a time: the ones left open are laid out again.
  expect(alones).toEqual([true, true])
})

it('tells sending every window to the hub apart from a lone minimize', async () => {
  vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(() => {
    throw new TypeError('Animation unavailable')
  })
  openAgentHubMirror(target('first'))
  openAgentHubMirror(target('second'))
  const alones: boolean[] = []
  renderMinimizeStage(alones)
  act(() => requestAgentHubMirrorsDock())
  await waitFor(() => expect(alones).toEqual([false, false]))
})

it('normalizes non-finite delay and lands exactly once on finish/cancel', () => {
  const element = document.createElement('div')
  const animation = { onfinish: () => {}, oncancel: () => {} }
  const animate = vi.fn((_keyframes: Keyframe[], _options: KeyframeAnimationOptions) => animation)
  Object.defineProperty(element, 'animate', { value: animate })
  const land = vi.fn()
  flyMirrorWindowToHub(element, null, land, Number.NaN)
  expect(animate.mock.calls[0]?.[1]).toMatchObject({ delay: 0 })
  animation.onfinish()
  animation.oncancel()
  expect(land).toHaveBeenCalledOnce()
})

it('lands immediately when the animation API throws', () => {
  const element = document.createElement('div')
  Object.defineProperty(element, 'animate', {
    value: () => {
      throw new TypeError('Animation unavailable')
    }
  })
  const land = vi.fn()
  flyMirrorWindowToHub(element, null, land)
  expect(land).toHaveBeenCalledOnce()
})

it('moves per-agent actions into tab menus, restores the singleton header and closes the mirror', async () => {
  vi.useFakeTimers({ toFake: ['performance'] })
  const reveal = vi.fn()
  openAgentHubMirror({ ...target('first'), agentType: 'codex' })
  function Stage(): React.JSX.Element {
    const { windows } = useAgentHubMirrors()
    return (
      <TooltipProvider>
        {windows.map((entry) => {
          const active = activeAgentHubMirrorTab(entry).target
          return (
            <AgentHubMirrorWindow
              key={entry.id}
              windowId={entry.id}
              windowState={entry}
              tabStrip={
                <AgentHubMirrorTabStrip
                  window={entry}
                  threads={[]}
                  lineage={EMPTY_AGENT_HUB_LINEAGE}
                  locationOf={(target) => ({
                    group: null,
                    project: target.tab.id,
                    workspace: null
                  })}
                  onReveal={(target) => reveal(target.tab.id)}
                />
              }
              target={active}
              thread={null}
              stackIndex={1}
              besideHubPanel={false}
              surface="in-workspace"
              nudge={null}
              onNudged={vi.fn()}
              family={null}
              locationOf={() => ({ group: null, project: 'Workspace', workspace: null })}
              familyActionsFor={() => ({})}
              onRetarget={vi.fn()}
              hubRef={{ current: null }}
              onSlot={vi.fn()}
              onFocus={vi.fn()}
              onClose={() => closeAgentHubMirror(entry.id)}
              onMinimize={() => minimizeAgentHubMirror(entry.id)}
              onReveal={() => reveal(active.tab.id)}
            />
          )
        })}
      </TooltipProvider>
    )
  }
  render(<Stage />)
  const header = screen.getByRole('dialog').querySelector('header')
  expect(screen.getByRole('tablist').closest('header')).toBe(header)
  expect(screen.getByRole('button', { name: 'Add terminal' }).closest('header')).toBe(header)
  expect(screen.queryByRole('button', { name: /Close mirror tab .*/ })).toBeNull()
  expect(
    screen.getByRole('button', { name: 'Jump' }).closest('[data-agent-hub-tab-entry]')
  ).toBeNull()
  const windowId = screen.getByRole('dialog').getAttribute('data-agent-hub-mirror-key')
  if (!windowId) {
    throw new Error('No mirror window')
  }
  act(() => {
    addAgentHubMirrorTab(windowId, { ...target('second'), agentType: 'codex' })
  })
  expect(screen.queryByRole('button', { name: 'Jump' })).toBeNull()
  await act(async () => {
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Close mirror' }))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  expect(screen.queryByRole('menuitem', { name: 'Close agent' })).toBeNull()
  fireEvent.contextMenu(screen.getByRole('tab', { name: 'first, idle' }))
  const closeInactiveAgent = await screen.findByRole('menuitem', { name: 'Close agent' })
  act(() => vi.advanceTimersByTime(400))
  fireEvent.click(closeInactiveAgent)
  expect(closeAgent).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      tab: expect.objectContaining({ id: 'first' }),
      paneKey: 'first:leaf'
    }),
    'idle'
  )
  expect(readAgentHubMirrors().windows[0]?.tabs).toHaveLength(2)
  closeAgent.mockClear()
  await settleClosedMenu()
  fireEvent.contextMenu(screen.getByRole('tab', { name: 'first, idle' }))
  fireEvent.click(
    await screen.findByRole('menuitem', { name: 'Jump to this terminal in its workspace' })
  )
  expect(reveal).toHaveBeenLastCalledWith('first')
  expect(screen.getAllByRole('tab')).toHaveLength(1)
  expect(
    screen.getByRole('button', { name: 'Jump' }).closest('[data-agent-hub-tab-entry]')
  ).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Jump' }))
  expect(reveal).toHaveBeenLastCalledWith('second')
  await settleClosedMenu()
  const close = screen.getByRole('button', { name: 'Close mirror' })
  fireEvent.contextMenu(close)
  const endAgent = await screen.findByRole('menuitem', { name: 'Close agent' })
  fireEvent.click(endAgent)
  expect(closeAgent).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(400))
  fireEvent.click(endAgent)
  expect(closeAgent).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      tab: expect.objectContaining({ id: 'second' }),
      paneKey: 'second:leaf'
    }),
    'idle'
  )
  expect(readAgentHubMirrors().windows).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Close mirror' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(closeAgent).toHaveBeenCalledTimes(1)
})

vi.mock('./agent-hub-mirror-source', async (original) => ({
  ...(await original<typeof MirrorSource>()),
  resolveAgentHubMirrorTarget: (
    target: Parameters<typeof MirrorSource.resolveAgentHubMirrorTarget>[0]
  ) => target
}))

it('keeps the home header while its microphone routes to the temporarily viewed terminal', () => {
  openAgentHubMirror(target('dispatcher'))
  const window = readAgentHubMirrors().windows[0]
  if (!window) {
    throw new Error('No window')
  }
  toggleAgentHubMirrorViewing(window.id, window.activeTabId, target('worker'))
  renderMinimizeStage([])
  expect(screen.getByRole('dialog', { name: 'dispatcher' })).toBeTruthy()
  expect(document.querySelector('[data-mic-tab="worker"]')).toBeTruthy()
  expect(document.querySelector('[data-mic-tab="dispatcher"]')).toBeNull()
})

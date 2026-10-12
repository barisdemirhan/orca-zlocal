import type * as MirrorSource from './agent-hub-mirror-source'
import { activeAgentHubMirrorTab } from './agent-hub-mirror-membership'
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
  minimizeAgentHubMirror,
  closeAgentHubMirror,
  openAgentHubMirror,
  resetAgentHubMirrorsForTest,
  useAgentHubMirrors
} from './agent-hub-mirror-store'
import { requestAgentHubMirrorsDock } from './agent-hub-mirror-signals'
import { flyMirrorWindowToHub } from './mirror-window-flight'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return { useAppStore: create(() => ({ settings: {}, keybindings: {}, tabsByWorktree: {} })) }
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
vi.mock('./AgentHubMirrorMicButton', () => ({ AgentHubMirrorMicButton: () => null }))
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
})

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

it('moves Jump into each tab menu, restores it for a singleton and closes the container', async () => {
  const reveal = vi.fn()
  openAgentHubMirror(target('first'))
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
    addAgentHubMirrorTab(windowId, target('second'))
  })
  expect(screen.queryByRole('button', { name: 'Jump' })).toBeNull()
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
  fireEvent.click(screen.getByRole('button', { name: 'Close mirror' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

vi.mock('./agent-hub-mirror-source', async (original) => ({
  ...(await original<typeof MirrorSource>()),
  resolveAgentHubMirrorTarget: (
    target: Parameters<typeof MirrorSource.resolveAgentHubMirrorTarget>[0]
  ) => target
}))

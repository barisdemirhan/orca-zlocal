import type * as MirrorSource from './agent-hub-mirror-source'
import { activeAgentHubMirrorTab } from './agent-hub-mirror-membership'
/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '../ui/tooltip'
import { makeTabWithIds, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { AgentHubMirrorWindow } from './AgentHubMirrorWindow'
import {
  minimizeAgentHubMirror,
  openAgentHubMirror,
  resetAgentHubMirrorsForTest,
  useAgentHubMirrors
} from './agent-hub-mirror-store'
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

it('clicks each real header minimize button into its own chip when animation cannot run', () => {
  vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(() => {
    throw new TypeError('Animation unavailable')
  })
  openAgentHubMirror(target('first'))
  openAgentHubMirror(target('second'))
  function Stage(): React.JSX.Element {
    const { windows, chips } = useAgentHubMirrors()
    return (
      <TooltipProvider>
        {windows.map((entry) => (
          <AgentHubMirrorWindow
            key={entry.id}
            windowId={entry.id}
            target={activeAgentHubMirrorTab(entry).target}
            thread={null}
            location={{ group: null, project: 'Workspace', workspace: null }}
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
            onMinimize={() => minimizeAgentHubMirror(entry.id)}
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
  fireEvent.click(screen.getAllByRole('button', { name: 'Minimize' })[0])
  expect(screen.getByText('first chip')).toBeDefined()
  fireEvent.click(screen.getAllByRole('button', { name: 'Minimize' })[0])
  expect(screen.getByText('second chip')).toBeDefined()
  expect(screen.queryAllByRole('dialog')).toHaveLength(0)
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

vi.mock('./agent-hub-mirror-source', async (original) => ({
  ...(await original<typeof MirrorSource>()),
  resolveAgentHubMirrorTarget: (
    target: Parameters<typeof MirrorSource.resolveAgentHubMirrorTarget>[0]
  ) => target
}))

// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AgentHubDock } from './AgentHubDock'
import { AgentHubStatusTrigger } from './AgentHubStatusTrigger'
import { AgentHubOrbButton } from './AgentHubOrbButton'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return { useAppStore: create(() => ({ settings: {}, keybindings: {} })) }
})
vi.mock('./use-dock-bar-motion', () => ({ useDockBarMotion: () => ({ size: null, rest: null }) }))
vi.mock('./use-viewport-size', () => ({ useViewportSize: () => ({ width: 1000, height: 800 }) }))
vi.mock('./use-agent-hub-terminal-counts', () => ({
  useAgentHubTerminalCounts: () => ({ agents: 0, all: 0 })
}))
vi.mock('./AgentHubDockMenu', () => ({ AgentHubDockMenu: () => null }))
vi.mock('./AgentHubDockArrangeButton', () => ({ AgentHubDockArrangeButton: () => null }))
beforeEach(() => {
  useAppStore.setState({ keybindings: { 'agentHub.toggleOrb': [] } })
})
afterEach(() => {
  cleanup()
  useAppStore.setState({ keybindings: {} })
})

const counts = { needsYou: 0, working: 0, finished: 0 }
describe('Orb dock button', () => {
  it.each(['bottom', 'top', 'left', 'right'] as const)(
    'stays first and clickable on the folded and unfolded %s dock',
    (edge) => {
      const open = vi.fn()
      const element = (pinned: boolean) => (
        <TooltipProvider>
          <AgentHubDock
            position={{ edge, offset: 0.5 }}
            size="medium"
            counts={counts}
            muted={false}
            pinned={pinned}
            mirrors={{ windows: 0, chips: 0 }}
            canvas={null}
            flushTop={false}
            terminals={{ threads: [], includeShells: false, parentOf: new Map() }}
            onOpenTab={vi.fn()}
            onNextWaiting={vi.fn()}
            onToggleMirrors={vi.fn()}
            onMove={vi.fn()}
            orb={{ state: { kind: 'idle' }, onOpen: open, disabled: false }}
          />{' '}
        </TooltipProvider>
      )
      const { container, rerender } = render(element(false))
      let button = screen.getByRole('button', { name: 'Talk to Orb · Not set' })
      expect(container.querySelector('button')).toBe(button)
      expect(button.closest('[inert]')).toBeNull()
      fireEvent.click(button)
      expect(open).toHaveBeenCalledOnce()
      rerender(element(true))
      button = screen.getByRole('button', { name: 'Talk to Orb · Not set' })
      expect(container.querySelector('button')).toBe(button)
      expect(container.querySelector('[data-expanded=true]')).not.toBeNull()
    }
  )
  it('uses the actual binding in the tooltip and updates when unbound', async () => {
    useAppStore.setState({ keybindings: { 'agentHub.toggleOrb': ['Mod+F8'] } })
    const { rerender } = render(
      <TooltipProvider delayDuration={0}>
        <AgentHubOrbButton state={{ kind: 'idle' }} side="top" onOpen={vi.fn()} />
      </TooltipProvider>
    )
    fireEvent.focus(screen.getByRole('button', { name: /^Talk to Orb · .*F8/ }))
    expect((await screen.findByRole('tooltip')).textContent).toContain('F8')
    useAppStore.setState({ keybindings: { 'agentHub.toggleOrb': [] } })
    rerender(
      <TooltipProvider delayDuration={0}>
        <AgentHubOrbButton state={{ kind: 'idle' }} side="top" onOpen={vi.fn()} />
      </TooltipProvider>
    )
    expect(screen.getByRole('button', { name: 'Talk to Orb · Not set' })).toBeTruthy()
  })
  it('explains Agent control being off and cannot open', () => {
    const open = vi.fn()
    render(
      <TooltipProvider>
        <AgentHubOrbButton disabled state={{ kind: 'off' }} side="top" onOpen={open} />
      </TooltipProvider>
    )
    const button = screen.getByRole('button', {
      name: 'Enable Agent control to talk to Orb · Not set'
    })
    fireEvent.click(button)
    expect(open).not.toHaveBeenCalled()
    expect(button.hasAttribute('disabled')).toBe(true)
  })
  it('shows the default quick access and the alternate Text action', async () => {
    useAppStore.setState({ keybindings: {} })
    render(
      <TooltipProvider delayDuration={0}>
        <AgentHubOrbButton state={{ kind: 'idle' }} side="top" onOpen={vi.fn()} />
      </TooltipProvider>
    )
    fireEvent.focus(screen.getByRole('button', { name: /^Talk to Orb · .*Space/ }))
    expect((await screen.findByRole('tooltip')).textContent).toContain('Text')
  })
  it.each([
    ['Macintosh', { metaKey: true }, { ctrlKey: true }],
    ['Windows', { ctrlKey: true }, { metaKey: true }],
    ['Linux', { ctrlKey: true }, { metaKey: true }]
  ] as const)(
    'uses the platform modifier for the alternate action on %s',
    (platform, modifier, other) => {
      const descriptor = Object.getOwnPropertyDescriptor(navigator, 'userAgent')
      Object.defineProperty(navigator, 'userAgent', { configurable: true, value: platform })
      try {
        const open = vi.fn()
        render(
          <TooltipProvider>
            <AgentHubOrbButton state={{ kind: 'idle' }} side="top" onOpen={open} />
          </TooltipProvider>
        )
        const button = screen.getByRole('button', { name: 'Talk to Orb · Not set' })
        fireEvent.click(button, modifier)
        expect(open).toHaveBeenLastCalledWith(true)
        fireEvent.click(button, other)
        expect(open).toHaveBeenLastCalledWith(false)
      } finally {
        if (descriptor) {
          Object.defineProperty(navigator, 'userAgent', descriptor)
        } else {
          Reflect.deleteProperty(navigator, 'userAgent')
        }
      }
    }
  )
  it('keeps the disabled tooltip hit area from opening or dragging the dock', () => {
    const inbox = vi.fn()
    const move = vi.fn()
    const { container } = render(
      <TooltipProvider>
        <AgentHubDock
          position={{ edge: 'bottom', offset: 0.5 }}
          size="medium"
          counts={counts}
          muted={false}
          pinned={false}
          mirrors={{ windows: 0, chips: 0 }}
          canvas={null}
          flushTop={false}
          terminals={{ threads: [], includeShells: false, parentOf: new Map() }}
          onOpenTab={inbox}
          onNextWaiting={vi.fn()}
          onToggleMirrors={vi.fn()}
          onMove={move}
          orb={{ state: { kind: 'off' }, onOpen: vi.fn(), disabled: true }}
        />
      </TooltipProvider>
    )
    const dock = container.querySelector('[data-agent-hub-dock]')
    if (!dock) {
      throw new Error('Expected dock')
    }
    Object.assign(dock, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() })
    const button = screen.getByRole('button', {
      name: 'Enable Agent control to talk to Orb · Not set'
    })
    const hit = button.closest('[data-agent-hub-dock-button]') ?? button
    fireEvent.pointerDown(hit, { button: 0, pointerId: 1, clientX: 400, clientY: 780 })
    fireEvent.pointerUp(hit, { button: 0, pointerId: 1, clientX: 400, clientY: 780 })
    expect(inbox).not.toHaveBeenCalled()
    expect(move).not.toHaveBeenCalled()
  })
  it('shows a call-back icon instead of the sphere while the Orb is out', () => {
    const open = vi.fn()
    render(
      <TooltipProvider>
        <AgentHubOrbButton state={{ kind: 'idle' }} side="top" onOpen={open} recall />
      </TooltipProvider>
    )
    const button = screen.getByRole('button', { name: 'Call Orb back · Not set' })
    expect(button.querySelector('[data-agent-hub-orb-mark]')).toBeNull()
    expect(button.querySelector('[data-agent-hub-orb-recall]')).not.toBeNull()
    fireEvent.click(button)
    expect(open).toHaveBeenCalledOnce()
  })

  it('places a separate Orb control ahead of the status counts without opening the hub', () => {
    const openOrb = vi.fn()
    const openHub = vi.fn()
    render(
      <TooltipProvider>
        <AgentHubStatusTrigger
          counts={counts}
          label="Agents"
          open={false}
          iconOnly={false}
          onClick={openHub}
          orb={<AgentHubOrbButton state={{ kind: 'idle' }} side="top" onOpen={openOrb} />}
        />
      </TooltipProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Talk to Orb · Not set' }))
    expect(openOrb).toHaveBeenCalledOnce()
    expect(openHub).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Agents' }))
    expect(openHub).toHaveBeenCalledOnce()
  })
})

/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '../ui/tooltip'
import { AgentHubDockArrangeButton } from './AgentHubDockArrangeButton'
import { arrangeAgentHubFloatingWindowsByDefault } from './agent-hub-floating-arrangement'
vi.mock('./agent-hub-floating-arrangement', () => ({
  arrangeAgentHubFloatingWindowsByDefault: vi.fn(),
  arrangeAgentHubFloatingWindowsOnScreen: vi.fn()
}))
vi.mock('@/store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({ settings: {}, keybindings: {}, updateSettings: vi.fn() })
}))
afterEach(cleanup)

it('is reachable for open mirrors and runs the same default arrangement as the shortcut', () => {
  const props = { side: 'top' as const, onOpenChange: vi.fn() }
  const { rerender } = render(
    <TooltipProvider>
      <AgentHubDockArrangeButton {...props} open={false} />
    </TooltipProvider>
  )
  expect(screen.queryByRole('button', { name: 'Arrange mirrors' })).toBeNull()
  rerender(
    <TooltipProvider>
      <AgentHubDockArrangeButton {...props} open />
    </TooltipProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Arrange mirrors' }))
  expect(arrangeAgentHubFloatingWindowsByDefault).toHaveBeenCalledOnce()
})

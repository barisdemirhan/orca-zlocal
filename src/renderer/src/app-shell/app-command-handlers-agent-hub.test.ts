import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppShortcutState, ShortcutDispatchInput } from './app-command-handlers'

vi.mock('../store', () => ({
  useAppStore: Object.assign(vi.fn(), { getState: () => ({}) })
}))

vi.mock('@/lib/floating-workspace-terminal-actions', () => ({
  isFloatingWorkspacePanelFocused: () => false
}))

vi.mock('@/lib/terminal-shortcut-capture-notification', () => ({
  showTerminalShortcutCaptureNotification: vi.fn()
}))

import { createAppCommandHandlers } from './app-command-handlers'
import { registerAgentHubCommands } from '@/components/agent-hub/agent-hub-commands'

function shortcutState(): AppShortcutState {
  return {
    activeView: 'terminal',
    activeWorktreeId: null,
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the agent hub handlers never read actions.
    actions: {} as AppShortcutState['actions'],
    creationLayoutActive: false,
    floatingTerminalEnabled: false,
    floatingTerminalOpen: false,
    floatingVisibleTabCount: 0,
    keybindings: {},
    openFloatingWorkspaceMaximized: vi.fn(),
    pluginCommands: [],
    setFloatingTerminalOpen: vi.fn(),
    terminalShortcutPolicy: 'orca-first',
    workspaceChromeActive: true
  }
}

function run(actionId: 'agentHub.toggle' | 'agentHub.nextWaiting'): {
  claimed: boolean | undefined
  input: ShortcutDispatchInput
} {
  const input: ShortcutDispatchInput = {
    target: null,
    defaultPrevented: false,
    preventDefault: vi.fn()
  }
  return { claimed: createAppCommandHandlers(shortcutState(), input).get(actionId)?.(), input }
}

describe('agent hub shortcuts', () => {
  let unregister: (() => void) | null = null
  afterEach(() => {
    unregister?.()
    unregister = null
  })

  it('lets the chord fall through while no hub is mounted', () => {
    const { claimed, input } = run('agentHub.toggle')

    expect(claimed).toBe(false)
    expect(input.preventDefault).not.toHaveBeenCalled()
  })

  it('routes both chords to the mounted hub', () => {
    const commands = { toggle: vi.fn(), jumpToNextWaiting: vi.fn() }
    unregister = registerAgentHubCommands(commands)

    expect(run('agentHub.toggle').claimed).toBe(true)
    expect(run('agentHub.nextWaiting').claimed).toBe(true)
    expect(commands.toggle).toHaveBeenCalledTimes(1)
    expect(commands.jumpToNextWaiting).toHaveBeenCalledTimes(1)
  })

  it('stops claiming the chord once the hub unmounts', () => {
    const commands = { toggle: vi.fn(), jumpToNextWaiting: vi.fn() }
    registerAgentHubCommands(commands)()

    expect(run('agentHub.toggle').claimed).toBe(false)
    expect(commands.toggle).not.toHaveBeenCalled()
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  AppShortcutState,
  ShortcutDispatchInput
} from '../lib/app-commands/app-command-handlers'

vi.mock('../store', () => ({
  useAppStore: Object.assign(vi.fn(), { getState: () => ({}) })
}))

vi.mock('@/components/floating-terminal/workspace/floating-workspace-terminal-actions', () => ({
  isFloatingWorkspacePanelFocused: () => false
}))

vi.mock('@/lib/notifications/terminal-shortcut-capture-notification', () => ({
  showTerminalShortcutCaptureNotification: vi.fn()
}))

const mirrorTabAvailable = vi.hoisted(() => ({ value: true }))
vi.mock('@/components/agent-hub/agent-hub-mirror-tab-command', () => ({
  agentHubMirrorTabCommandAvailable: () => mirrorTabAvailable.value
}))

import { createAppCommandHandlers } from '../lib/app-commands/app-command-handlers'
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

function run(
  actionId:
    | 'agentHub.toggle'
    | 'agentHub.nextWaiting'
    | 'agentHub.dockMirrors'
    | 'agentHub.toggleCanvas'
    | 'agentHub.arrangeMirrors'
    | 'agentHub.focusMirror'
    | 'agentHub.popOut'
    | 'agentHub.jumpToMirror'
    | 'agentHub.nextMirrorTab'
    | 'agentHub.previousMirrorTab'
): {
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

  it('lets the canvas chord fall through while the canvas setting is off', () => {
    unregister = registerAgentHubCommands({
      toggle: vi.fn(),
      jumpToNextWaiting: vi.fn(),
      toggleMirrors: vi.fn(),
      toggleCanvas: null,
      focusMirror: vi.fn(),
      popOut: vi.fn(),
      jumpToMirror: vi.fn(),
      arrangeMirrors: vi.fn()
    })

    const { claimed, input } = run('agentHub.toggleCanvas')

    expect(claimed).toBe(false)
    expect(input.preventDefault).not.toHaveBeenCalled()
  })

  it('lets the arrange chord fall through while no mirror is open', () => {
    unregister = registerAgentHubCommands({
      toggle: vi.fn(),
      jumpToNextWaiting: vi.fn(),
      toggleMirrors: vi.fn(),
      toggleCanvas: vi.fn(),
      focusMirror: null,
      popOut: null,
      jumpToMirror: null,
      arrangeMirrors: null
    })

    const { claimed, input } = run('agentHub.arrangeMirrors')

    expect(claimed).toBe(false)
    expect(input.preventDefault).not.toHaveBeenCalled()
  })

  it('cycles mirror tabs only while a multi-tab mirror has focus', () => {
    const commands = {
      toggle: vi.fn(),
      jumpToNextWaiting: vi.fn(),
      toggleMirrors: vi.fn(),
      toggleCanvas: vi.fn(),
      focusMirror: vi.fn(),
      popOut: vi.fn(),
      jumpToMirror: vi.fn(),
      arrangeMirrors: vi.fn(),
      nextMirrorTab: vi.fn(),
      previousMirrorTab: vi.fn()
    }
    unregister = registerAgentHubCommands(commands)

    expect(run('agentHub.nextMirrorTab').claimed).toBe(true)
    expect(run('agentHub.previousMirrorTab').claimed).toBe(true)
    expect(commands.nextMirrorTab).toHaveBeenCalledTimes(1)
    expect(commands.previousMirrorTab).toHaveBeenCalledTimes(1)

    mirrorTabAvailable.value = false
    const fallThrough = run('agentHub.nextMirrorTab')
    expect(fallThrough.claimed).toBe(false)
    expect(fallThrough.input.preventDefault).not.toHaveBeenCalled()
    expect(commands.nextMirrorTab).toHaveBeenCalledTimes(1)
    mirrorTabAvailable.value = true
  })

  it('stops claiming the chord once the hub unmounts', () => {
    const commands = {
      toggle: vi.fn(),
      jumpToNextWaiting: vi.fn(),
      toggleMirrors: vi.fn(),
      toggleCanvas: vi.fn(),
      focusMirror: vi.fn(),
      popOut: vi.fn(),
      jumpToMirror: vi.fn(),
      arrangeMirrors: vi.fn()
    }
    registerAgentHubCommands(commands)()

    expect(run('agentHub.toggle').claimed).toBe(false)
    expect(commands.toggle).not.toHaveBeenCalled()
  })
})

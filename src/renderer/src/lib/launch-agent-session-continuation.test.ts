import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const launchAgentInNewTab = vi.hoisted(() => vi.fn())
const writeClipboardText = vi.hoisted(() => vi.fn(async () => undefined))
const ensureDetectedAgentsForWorktree = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  info: vi.fn()
}))
const mirror = vi.hoisted(() => ({
  addTab: vi.fn(() => ({ status: 'changed' }))
}))
const store = vi.hoisted(() => {
  const settings: { disabledTuiAgents: string[]; experimentalNativeChat?: boolean } = {
    disabledTuiAgents: []
  }
  return {
    createEmptySplitGroup: vi.fn((): string | null => 'group-split'),
    closeEmptyGroup: vi.fn(),
    getKnownWorktreeById: () => undefined,
    settings
  }
})

vi.mock('@/store', () => ({ useAppStore: { getState: () => store } }))
vi.mock('@/components/agent-hub/agent-hub-mirror-continuation', () => ({
  addLaunchedSessionToAgentHubMirror: mirror.addTab
}))
vi.mock('@/lib/launch-agent-in-new-tab', () => ({ launchAgentInNewTab }))
vi.mock('@/lib/agent-catalog', () => ({
  getAgentCatalog: () => [{ id: 'claude', label: 'Claude' }],
  getAgentLabel: (agent: string) => (agent === 'codex' ? 'Codex' : 'Claude')
}))
vi.mock('@/lib/agent-detection-target-inventory', () => ({
  ensureDetectedAgentsForWorktree,
  // A declined chat falls back to a terminal only where the agent's CLI was detected.
  readAgentInventoryForTarget: () => ({ ids: ['claude'], state: 'successful' })
}))
vi.mock('sonner', () => ({ toast }))
vi.mock('./host-chat-program-acquisition', () => ({
  acquireAgentLaunchChoices: async (_: unknown, run: () => unknown) => {
    const detected = await run()
    return { detected, offered: detected }
  }
}))
vi.mock('./host-chat-program', () => ({ agentChoicePending: () => false }))
vi.mock('@/runtime/structured-agent-session-client', () => ({
  callStructuredAgentSession: vi.fn(async () => ({ supported: false, reason: 'wsl' }))
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    Object.entries(values ?? {}).reduce(
      (message, [key, value]) => message.replace(`{{${key}}}`, value),
      fallback
    )
}))

describe('launchAgentSessionContinuation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mirror.addTab.mockReturnValue({ status: 'changed' })
    store.createEmptySplitGroup.mockReturnValue('group-split')
    store.settings.disabledTuiAgents = []
    ensureDetectedAgentsForWorktree.mockResolvedValue(['claude', 'codex'])
    launchAgentInNewTab.mockReturnValue({
      surface: { kind: 'local-terminal', tabId: 'tab-new' },
      promptDeliveryResult: Promise.resolve({ delivered: true, failureNotified: false })
    })
    writeClipboardText.mockClear()
    vi.stubGlobal('window', {
      api: {
        ui: { writeClipboardText }
      }
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('launches any detected target Agent in the same workspace and cwd', async () => {
    const { launchAgentSessionContinuation } = await import('./launch-agent-session-continuation')

    await expect(
      launchAgentSessionContinuation({
        agent: 'claude',
        prompt: 'continue the unfinished task',
        worktreeId: 'wt-1',
        groupId: 'group-1',
        initialCwd: '/repo/worktree/packages/app',
        launchSource: 'terminal_context_menu'
      })
    ).resolves.toBe(true)

    expect(launchAgentInNewTab).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: 'claude',
        worktreeId: 'wt-1',
        groupId: 'group-1',
        initialCwd: '/repo/worktree/packages/app',
        promptDelivery: 'draft'
      })
    )
  })

  it("detects the target Agent in the workspace host's inventory", async () => {
    const { detectAgentSessionContinuationAgents } =
      await import('./launch-agent-session-continuation')

    const { detected } = await detectAgentSessionContinuationAgents('wt-1')
    expect(detected).toEqual(['claude', 'codex'])
    expect(ensureDetectedAgentsForWorktree).toHaveBeenCalledWith(store, 'wt-1')
  })

  it('stops before launch when the selected Agent is unavailable', async () => {
    ensureDetectedAgentsForWorktree.mockResolvedValue(['claude'])
    const { launchAgentSessionContinuation } = await import('./launch-agent-session-continuation')

    await expect(
      launchAgentSessionContinuation({
        agent: 'codex',
        prompt: 'continue',
        worktreeId: 'wt-1',
        launchSource: 'sidebar'
      })
    ).resolves.toBe(false)

    expect(launchAgentInNewTab).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Codex was not detected on this workspace host.')
  })

  it('distinguishes prompt delivery failure from terminal launch failure', async () => {
    launchAgentInNewTab.mockReturnValue({
      surface: { kind: 'local-terminal', tabId: 'tab-new' },
      promptDeliveryResult: Promise.resolve({ delivered: false, failureNotified: false })
    })
    const { launchAgentSessionContinuation } = await import('./launch-agent-session-continuation')

    await launchAgentSessionContinuation({
      agent: 'codex',
      prompt: 'continue',
      worktreeId: 'wt-1',
      launchSource: 'sidebar'
    })

    expect(launchAgentInNewTab).toHaveBeenCalledWith(
      expect.objectContaining({ agent: 'codex', promptDelivery: 'submit-after-ready' })
    )
    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'The new Codex session started, but its context could not be sent.',
        expect.objectContaining({ action: expect.objectContaining({ label: 'Copy prompt' }) })
      )
    )
  })

  it('hedges instead of claiming success when the paste went out unconfirmed', async () => {
    // Windows may force blind paste; do not report a handoff delivered when its composer was never observed (#22479).
    launchAgentInNewTab.mockImplementation(
      (args: {
        onPromptDelivered?: () => void
        onPromptDeliveryUnconfirmed?: () => void
      }): unknown => {
        args.onPromptDeliveryUnconfirmed?.()
        args.onPromptDelivered?.()
        return {
          surface: { kind: 'local-terminal', tabId: 'tab-new' },
          promptDeliveryResult: Promise.resolve({ delivered: true, failureNotified: false })
        }
      }
    )
    const { launchAgentSessionContinuation } = await import('./launch-agent-session-continuation')

    await launchAgentSessionContinuation({
      agent: 'codex',
      prompt: 'continue the unfinished task',
      worktreeId: 'wt-1',
      launchSource: 'sidebar'
    })

    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalledWith(
      'Orca could not confirm Codex received the session context. Check the new session, and paste it yourself if its input is empty.',
      expect.objectContaining({ action: expect.objectContaining({ label: 'Copy prompt' }) })
    )
    toast.warning.mock.calls[0][1].action.onClick()
    expect(writeClipboardText).toHaveBeenCalledWith('continue the unfinished task')
  })

  it('keeps the confirmed-delivery toast visible until dismissed', async () => {
    launchAgentInNewTab.mockImplementation((args: { onPromptDelivered?: () => void }): unknown => {
      args.onPromptDelivered?.()
      return {
        surface: { kind: 'local-terminal', tabId: 'tab-new' },
        promptDeliveryResult: Promise.resolve({ delivered: true, failureNotified: false })
      }
    })
    const { launchAgentSessionContinuation } = await import('./launch-agent-session-continuation')

    await launchAgentSessionContinuation({
      agent: 'codex',
      prompt: 'continue',
      worktreeId: 'wt-1',
      launchSource: 'sidebar'
    })

    expect(toast.success).toHaveBeenCalledWith(
      'Session context sent to Codex in a new session.',
      expect.objectContaining({ duration: Infinity, dismissible: true })
    )
    expect(toast.warning).not.toHaveBeenCalled()
  })

  describe('placement from a mirror pane', () => {
    const base = {
      agent: 'claude',
      prompt: 'continue',
      worktreeId: 'wt-1',
      groupId: 'group-1',
      launchSource: 'terminal_context_menu'
    } as const
    const fromMirror = (placement: 'tab' | 'pane' | 'jump') => ({
      ...base,
      mirror: { windowId: 'mirror-1', tabId: 'tab-src', placement }
    })

    it('keeps the legacy jump outside a mirror', async () => {
      const { launchAgentSessionContinuation } = await import('./launch-agent-session-continuation')
      await launchAgentSessionContinuation(base)

      const args = launchAgentInNewTab.mock.calls[0]?.[0]
      expect(args).toMatchObject({ groupId: 'group-1' })
      expect(args).not.toHaveProperty('activate')
      expect(store.createEmptySplitGroup).not.toHaveBeenCalled()
      expect(mirror.addTab).not.toHaveBeenCalled()
    })

    it('opens "jump" in the source group and activates it', async () => {
      const { launchAgentSessionContinuation } = await import('./launch-agent-session-continuation')
      await launchAgentSessionContinuation(fromMirror('jump'))

      expect(launchAgentInNewTab.mock.calls[0]?.[0]).not.toHaveProperty('activate')
      expect(mirror.addTab).not.toHaveBeenCalled()
    })

    it('adds the new session as a tab of the source mirror for "tab"', async () => {
      const { launchAgentSessionContinuation } = await import('./launch-agent-session-continuation')
      await launchAgentSessionContinuation(fromMirror('tab'))

      expect(launchAgentInNewTab).toHaveBeenCalledWith(
        expect.objectContaining({ groupId: 'group-1', activate: false })
      )
      expect(store.createEmptySplitGroup).not.toHaveBeenCalled()
      expect(mirror.addTab).toHaveBeenCalledWith({
        windowId: 'mirror-1',
        worktreeId: 'wt-1',
        sourceTabId: 'tab-src',
        newTabId: 'tab-new',
        agent: 'claude'
      })
    })

    it('splits quietly and mirrors the new pane for "pane"', async () => {
      const { launchAgentSessionContinuation } = await import('./launch-agent-session-continuation')
      await launchAgentSessionContinuation(fromMirror('pane'))

      expect(store.createEmptySplitGroup).toHaveBeenCalledWith('wt-1', 'group-1', 'right', {
        activate: false
      })
      expect(launchAgentInNewTab).toHaveBeenCalledWith(
        expect.objectContaining({ groupId: 'group-split', activate: false })
      )
      expect(mirror.addTab).toHaveBeenCalledOnce()
    })

    it('removes the empty split when the launch fails', async () => {
      launchAgentInNewTab.mockReturnValue(null)
      const { launchAgentSessionContinuation } = await import('./launch-agent-session-continuation')

      await expect(launchAgentSessionContinuation(fromMirror('pane'))).resolves.toBe(false)
      expect(store.closeEmptyGroup).toHaveBeenCalledWith('wt-1', 'group-split')
    })

    it('tells the user when the mirror cannot take the tab', async () => {
      mirror.addTab.mockReturnValue({ status: 'tab-cap' })
      const { launchAgentSessionContinuation } = await import('./launch-agent-session-continuation')

      await expect(launchAgentSessionContinuation(fromMirror('tab'))).resolves.toBe(true)
      expect(toast.info).toHaveBeenCalled()
    })
  })
})

it('retains the accepted route across detection, and explicit chat declines without the preference fallback', async () => {
  const { launchAgentSessionContinuation } = await import('./launch-agent-session-continuation')
  const { beginHostAdmittedStructuredLaunch } =
    await import('./structured-agent-session-launch-admission')
  for (const requestedSurface of [undefined, 'chat'] as const) {
    const detected = Promise.withResolvers<string[]>()
    ensureDetectedAgentsForWorktree.mockReturnValueOnce(detected.promise)
    const pending = launchAgentSessionContinuation({
      agent: 'claude',
      prompt: 'continue',
      worktreeId: 'wt-1',
      groupId: 'group-1',
      initialCwd: '/repo/.',
      launchSource: 'sidebar',
      launchChoice: {
        agent: 'claude',
        route: 'structured-native-chat',
        executionHostId: 'local',
        requestedSurface
      }
    })
    store.settings.experimentalNativeChat = false
    detected.resolve(['claude'])
    await pending
    const args = launchAgentInNewTab.mock.calls.at(-1)?.[0]
    expect(args).toMatchObject({
      initialCwd: '/repo/.',
      groupId: 'group-1',
      prompt: 'continue',
      agentSessionLaunchPlan: { route: 'structured-native-chat', requestedSurface }
    })
    const fallback = vi.fn(() => ({ opened: true }))
    const launch = beginHostAdmittedStructuredLaunch({
      plan: args.agentSessionLaunchPlan,
      hooks: {},
      worktreeId: 'wt-1',
      executionHostId: 'local',
      target: { kind: 'local' },
      openAdmitted: vi.fn(),
      onHostDeclined: fallback
    })
    await expect(launch.settlement).resolves.toMatchObject({
      kind: requestedSurface ? 'failed' : 'terminal'
    })
    expect(fallback).toHaveBeenCalledTimes(requestedSurface ? 0 : 1)
  }
})

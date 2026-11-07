import type * as ReactModule from 'react'
import type * as StoreModule from '@/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PASTE_TERMINAL_TEXT_EVENT } from '@/constants/terminal'
import { useTerminalPaneGlobalEffects } from './use-terminal-pane-global-effects'
import { TERMINAL_PASTE_DIRECT_MAX_BYTES } from './input/paste/terminal-paste-limits'
import {
  acquireTerminalInputMountLease,
  hasTerminalMountRetentionLease
} from './terminal-mount-retention-leases'
import {
  cleanupGlobalEffectsTestWindow,
  installGlobalEffectsTestWindow
} from './use-terminal-pane-global-effects-test-harness'

const mocks = vi.hoisted(() => ({
  captureScrollState: vi.fn(),
  fitAndFocusPanes: vi.fn(),
  fitPanes: vi.fn(),
  focusActivePane: vi.fn(),
  flushTerminalOutput: vi.fn(),
  getTerminalOutputEpoch: vi.fn(() => 0),
  enforceTerminalCurrentScrollIntent: vi.fn(),
  syncTerminalScrollIntentFromViewport: vi.fn(),
  pasteTerminalText: vi.fn(),
  recordTerminalUserInputForLeaf: vi.fn(),
  requestTerminalBacklogRecovery: vi.fn(),
  restoreScrollState: vi.fn(),
  restoreScrollStateAfterLayout: vi.fn()
}))

const reactRefState = vi.hoisted(() => ({
  slots: [] as { current: unknown }[],
  index: 0
}))

function beginHookRender(): void {
  reactRefState.index = 0
}

function resetHookRefs(): void {
  reactRefState.slots = []
  reactRefState.index = 0
}

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>()
  return {
    ...actual,
    useCallback: <T extends (...args: never[]) => unknown>(callback: T) => callback,
    useEffect: (effect: () => void | (() => void)) => {
      effect()
    },
    useRef: <T>(value: T) => {
      const index = reactRefState.index
      reactRefState.index += 1
      if (!reactRefState.slots[index]) {
        reactRefState.slots[index] = { current: value }
      }
      return reactRefState.slots[index] as { current: T }
    }
  }
})

vi.mock('./pane-helpers', () => ({
  fitAndFocusPanes: mocks.fitAndFocusPanes,
  fitPanes: mocks.fitPanes,
  focusActivePane: mocks.focusActivePane
}))

vi.mock('@/lib/pane-manager/pane-terminal-output-scheduler', () => ({
  flushTerminalOutput: mocks.flushTerminalOutput,
  requestTerminalBacklogRecovery: mocks.requestTerminalBacklogRecovery
}))

vi.mock('@/lib/pane-manager/pane-scroll', () => ({
  captureScrollState: mocks.captureScrollState,
  getTerminalOutputEpoch: mocks.getTerminalOutputEpoch,
  restoreScrollState: mocks.restoreScrollState,
  restoreScrollStateAfterLayout: mocks.restoreScrollStateAfterLayout
}))

vi.mock('@/lib/pane-manager/terminal-scroll-intent', () => ({
  enforceTerminalCurrentScrollIntent: mocks.enforceTerminalCurrentScrollIntent,
  syncTerminalScrollIntentFromViewport: mocks.syncTerminalScrollIntentFromViewport
}))

vi.mock('./input/paste/terminal-bracketed-paste', () => ({
  BRACKETED_PASTE_END: '\u001b[201~',
  BRACKETED_PASTE_START: '\u001b[200~',
  pasteTerminalText: mocks.pasteTerminalText,
  sanitizeTerminalPasteText: (text: string) => text.split('\u001b').join('\u241b')
}))

vi.mock('./terminal-input-activity', () => ({
  recordTerminalUserInputForLeaf: mocks.recordTerminalUserInputForLeaf
}))

// This harness runs hooks without React rendering; use real synchronous store snapshots instead of reactive selectors that would throw invalid-hook-call.
vi.mock('@/store', async (importOriginal) => {
  const actual = await importOriginal<typeof StoreModule>()
  const realHook = actual.useAppStore
  const testHook = ((selector?: (state: ReturnType<typeof realHook.getState>) => unknown) =>
    selector ? selector(realHook.getState()) : realHook.getState()) as typeof realHook
  Object.assign(testHook, realHook)
  return { ...actual, useAppStore: testHook }
})

async function flushPasteTasks(iterations = 3): Promise<void> {
  for (let index = 0; index < iterations; index++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

describe('useTerminalPaneGlobalEffects', () => {
  beforeEach(() => {
    resetHookRefs()
    vi.clearAllMocks()
    installGlobalEffectsTestWindow()
  })

  it('inserts into the leased inactive dictation origin without focusing it or falling back to another pane', async () => {
    const documentEvents = new EventTarget()
    vi.stubGlobal('document', documentEvents)
    const terminal = { focus: vi.fn(), modes: { bracketedPasteMode: false } }
    const pane = { id: 7, leafId: 'origin-leaf', terminal }
    const manager = { getPanes: () => [pane], getActivePane: () => pane, suspendRendering: vi.fn() }
    const transport = { getPtyId: () => 'pty-origin', isConnected: () => true }
    beginHookRender()
    useTerminalPaneGlobalEffects({
      tabId: 'origin-tab',
      worktreeId: 'wt-origin',
      isActive: false,
      isVisible: false,
      isSyncFitEnabled: false,
      paneCount: 1,
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: inactive effects and the paste path only use the supplied manager methods.
      managerRef: { current: manager as never },
      containerRef: { current: null },
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: short unbracketed dictation only reads the transport identity and connection state.
      paneTransportsRef: { current: new Map([[7, transport]]) as never },
      isActiveRef: { current: false },
      isVisibleRef: { current: false },
      toggleExpandPane: vi.fn()
    })
    const release = acquireTerminalInputMountLease({ worktreeId: 'wt-origin', tabId: 'origin-tab' })
    try {
      documentEvents.dispatchEvent(
        new CustomEvent('dictation:insertText', {
          detail: { tabId: 'origin-tab', paneId: 7, text: 'origin only' }
        })
      )
      release()
      expect(hasTerminalMountRetentionLease('wt-origin', 'origin-tab')).toBe(true)
      await flushPasteTasks()
      expect(hasTerminalMountRetentionLease('wt-origin', 'origin-tab')).toBe(false)
      expect(mocks.pasteTerminalText).toHaveBeenCalledWith(terminal, 'origin only', {
        forceBracketedPaste: false
      })
      expect(terminal.focus).not.toHaveBeenCalled()
      mocks.pasteTerminalText.mockClear()
      const releaseMissing = acquireTerminalInputMountLease({
        worktreeId: 'wt-origin',
        tabId: 'origin-tab'
      })
      documentEvents.dispatchEvent(
        new CustomEvent('dictation:insertText', {
          detail: { tabId: 'origin-tab', paneId: 99, text: 'closed pane' }
        })
      )
      await flushPasteTasks()
      expect(mocks.pasteTerminalText).not.toHaveBeenCalled()
      releaseMissing()
    } finally {
      release()
    }
  })

  describe('dictation leaf addressing', () => {
    function useDictationHarness(isActive: boolean) {
      const documentEvents = new EventTarget()
      vi.stubGlobal('document', documentEvents)
      const terminal = { focus: vi.fn(), modes: { bracketedPasteMode: false } }
      const other = { focus: vi.fn(), modes: { bracketedPasteMode: false } }
      const pane = { id: 3, leafId: 'leaf-a', terminal }
      const otherPane = { id: 4, leafId: 'leaf-b', terminal: other }
      const manager = {
        getPanes: () => [pane, otherPane],
        getActivePane: () => otherPane,
        resumeRendering: vi.fn(),
        resetWebglTextureAtlases: vi.fn(),
        scheduleRevealRepaint: vi.fn(),
        scheduleRevealPresent: vi.fn(),
        fitAllRevealedPanes: vi.fn(),
        suspendRendering: vi.fn()
      }
      const transports = new Map(
        [3, 4].map((id) => [id, { getPtyId: () => `pty-${id}`, isConnected: () => true }])
      )
      beginHookRender()
      useTerminalPaneGlobalEffects({
        tabId: 'tab-d',
        worktreeId: 'wt-d',
        isActive,
        isVisible: isActive,
        isSyncFitEnabled: false,
        paneCount: 2,
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: dictation only uses the supplied manager methods.
        managerRef: { current: manager as never },
        containerRef: { current: null },
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: short dictation only reads transport identity and connection state.
        paneTransportsRef: { current: transports as never },
        isActiveRef: { current: isActive },
        isVisibleRef: { current: isActive },
        toggleExpandPane: vi.fn()
      })
      const dispatch = (detail: unknown): void => {
        documentEvents.dispatchEvent(new CustomEvent('dictation:insertText', { detail }))
      }
      return { terminal, other, dispatch }
    }

    it('delivers a leaf-addressed insert to that pane, marks it accepted, and keeps focus', async () => {
      const { terminal, other, dispatch } = useDictationHarness(false)
      const detail: { text: string; tabId: string; leafId: string; accepted?: boolean } = {
        text: 'hello',
        tabId: 'tab-d',
        leafId: 'leaf-a'
      }
      dispatch(detail)
      await flushPasteTasks()
      expect(mocks.pasteTerminalText).toHaveBeenCalledWith(terminal, 'hello', {
        forceBracketedPaste: false
      })
      expect(other.focus).not.toHaveBeenCalled()
      expect(terminal.focus).not.toHaveBeenCalled()
      expect(detail.accepted).toBe(true)
    })

    it('ignores an unknown leaf id and leaves accepted unset', async () => {
      const { dispatch } = useDictationHarness(true)
      const detail: { text: string; tabId: string; leafId: string; accepted?: boolean } = {
        text: 'lost',
        tabId: 'tab-d',
        leafId: 'gone'
      }
      dispatch(detail)
      await flushPasteTasks()
      expect(mocks.pasteTerminalText).not.toHaveBeenCalled()
      expect(detail.accepted).toBeUndefined()
    })

    it('still pastes a bare string into the active tab, focusing it', async () => {
      const { other, dispatch } = useDictationHarness(true)
      dispatch('legacy text')
      await flushPasteTasks()
      expect(mocks.pasteTerminalText).toHaveBeenCalledWith(other, 'legacy text', {
        forceBracketedPaste: false
      })
      expect(other.focus).toHaveBeenCalledOnce()
    })

    it('ignores a bare string in an inactive tab', async () => {
      const { dispatch } = useDictationHarness(false)
      dispatch('nope')
      await flushPasteTasks()
      expect(mocks.pasteTerminalText).not.toHaveBeenCalled()
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    cleanupGlobalEffectsTestWindow()
  })

  it('chunks large programmatic paste events through the pane PTY transport', async () => {
    const largePaste = `${'x'.repeat(TERMINAL_PASTE_DIRECT_MAX_BYTES)}tail`
    const terminal = { name: 'terminal-a', focus: vi.fn(), modes: { bracketedPasteMode: false } }
    const pane = { id: 1, leafId: 'leaf-1', terminal }
    const manager = {
      getPanes: vi.fn(() => [pane]),
      resumeRendering: vi.fn(),
      resetWebglTextureAtlases: vi.fn(),
      scheduleRevealRepaint: vi.fn(),
      scheduleRevealPresent: vi.fn(),
      suspendRendering: vi.fn(),
      fitAllRevealedPanes: vi.fn(),
      getActivePane: vi.fn(() => pane)
    }
    const transport = {
      getPtyId: vi.fn(() => 'pty-1'),
      isConnected: vi.fn(() => true),
      sendInput: vi.fn<(data: string) => boolean>(() => true)
    }

    beginHookRender()
    useTerminalPaneGlobalEffects({
      tabId: 'tab-1',
      worktreeId: 'wt-1',
      isActive: true,
      isVisible: true,
      isSyncFitEnabled: true,
      paneCount: 1,
      managerRef: { current: manager as never },
      containerRef: { current: null },
      paneTransportsRef: { current: new Map([[1, transport]]) as never },
      isActiveRef: { current: false },
      isVisibleRef: { current: false },
      toggleExpandPane: vi.fn()
    })

    const pasteListener = vi
      .mocked(window.addEventListener)
      .mock.calls.find(([eventName]) => eventName === PASTE_TERMINAL_TEXT_EVENT)

    expect(pasteListener).toBeDefined()
    const listener = pasteListener?.[1]
    if (typeof listener !== 'function') {
      throw new Error('expected paste listener')
    }
    listener(
      new CustomEvent(PASTE_TERMINAL_TEXT_EVENT, { detail: { tabId: 'tab-1', text: largePaste } })
    )

    await flushPasteTasks(12)

    expect(mocks.pasteTerminalText).not.toHaveBeenCalled()
    expect(transport.sendInput.mock.calls.map((call) => call[0]).join('')).toBe(largePaste)
    expect(transport.sendInput.mock.calls.length).toBeGreaterThan(1)
    expect(mocks.recordTerminalUserInputForLeaf).toHaveBeenCalledWith('tab-1', 'leaf-1')
    expect(terminal.focus).toHaveBeenCalledOnce()
  })
})

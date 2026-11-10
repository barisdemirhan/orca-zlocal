/** @vitest-environment happy-dom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const harness = vi.hoisted(() => ({ mounts: 0 }))

vi.mock('../../store', async () => {
  const { create } = await import('zustand')
  const useAppStore = create(() => ({
    pendingStartupByTabId: {} as Record<string, unknown>,
    settings: { experimentalAgentHub: false },
    focusGroup: () => {}
  }))
  return { useAppStore }
})

vi.mock('./TerminalPane', async () => {
  const { useEffect } = await import('react')
  return {
    default: function TerminalPaneProbe() {
      useEffect(() => {
        harness.mounts += 1
      }, [])
      return <div data-terminal-pane-probe />
    }
  }
})

import { useAppStore } from '../../store'
import { TerminalOverlaySlot } from './mounting/TerminalOverlaySlot'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  harness.mounts = 0
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function setAgentHub(enabled: boolean): void {
  const settings = useAppStore.getState().settings
  if (settings) {
    act(() => useAppStore.setState({ settings: { ...settings, experimentalAgentHub: enabled } }))
  }
}

function renderSlot(tabId: string): void {
  act(() => {
    root.render(
      <TerminalOverlaySlot
        terminalTabId={tabId}
        terminalGeneration={0}
        worktreeId="wt-1"
        worktreePath="/repo"
        startupCwd={undefined}
        groupId={undefined}
        isWorktreeActive
        isVisible
        isActive
        activityTerminalPortal={null}
        onFocusOwningGroup={undefined}
        consumeSuppressedPtyExit={() => false}
        captureEmptiedReaction={() => () => {}}
      />
    )
  })
}

it('keeps an open pane mounted when the Agent Hub setting is toggled', () => {
  renderSlot('tab-1')
  expect(harness.mounts).toBe(1)

  setAgentHub(true)
  renderSlot('tab-1')
  setAgentHub(false)
  renderSlot('tab-1')

  expect(harness.mounts).toBe(1)
  expect(container.querySelectorAll('[data-terminal-pane-probe]')).toHaveLength(1)
})

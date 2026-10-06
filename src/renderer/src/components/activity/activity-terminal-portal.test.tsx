/** @vitest-environment happy-dom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  setActivityTerminalPortals,
  useActivityTerminalPortals,
  setAgentHubTerminalPortals,
  type ActivityTerminalPortalTarget
} from './activity-terminal-portal'
import { useActivityTerminalPortalStatus } from './activity-terminal-portal-status'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root

beforeEach(() => setActivityTerminalPortals([]))

afterEach(() => {
  act(() => root?.unmount())
  setActivityTerminalPortals([])
  setAgentHubTerminalPortals([])
})

function portal(target: HTMLElement): ActivityTerminalPortalTarget {
  return {
    slotId: 'primary',
    requestToken: 'primary:tab-a:leaf-a',
    target,
    worktreeId: 'worktree-a',
    tabId: 'tab-a',
    paneKey: 'tab-a:leaf-a',
    forceUnavailable: false,
    active: true
  }
}

describe('Activity terminal portal publication', () => {
  it('reports unavailable while Hub owns the same source, and resumes loading when it returns', async () => {
    const descriptor = portal(document.createElement('div'))
    descriptor.paneKey = 'tab-a:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    setActivityTerminalPortals([descriptor])
    let status = 'loading'
    function Subscriber(): null {
      status = useActivityTerminalPortalStatus(descriptor.target, descriptor.paneKey)
      return null
    }
    root = createRoot(document.createElement('div'))
    act(() => root.render(<Subscriber />))
    await act(async () => {
      setAgentHubTerminalPortals([
        {
          ...descriptor,
          owner: 'agent-hub',
          slotId: 'agent-hub:origin',
          target: document.createElement('div'),
          active: false
        }
      ])
      await new Promise((resolve) => setTimeout(resolve, 40))
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40))
    })
    expect(status).toBe('unavailable')
    await act(async () => {
      setAgentHubTerminalPortals([])
      await new Promise((resolve) => setTimeout(resolve, 40))
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40))
    })
    expect(status).toBe('loading')
  })
  it('does not notify Terminal for a value-identical descriptor array', () => {
    const descriptor = portal(document.createElement('div'))
    setActivityTerminalPortals([descriptor])
    let renders = 0

    function Subscriber(): null {
      useActivityTerminalPortals(true)
      renders += 1
      return null
    }

    root = createRoot(document.createElement('div'))
    act(() => root.render(<Subscriber />))
    const initialRenders = renders
    act(() => setActivityTerminalPortals([{ ...descriptor }]))
    expect(renders).toBe(initialRenders)
  })

  it('notifies Terminal when a routing value changes', () => {
    const descriptor = portal(document.createElement('div'))
    setActivityTerminalPortals([descriptor])
    let renders = 0

    function Subscriber(): null {
      useActivityTerminalPortals(true)
      renders += 1
      return null
    }

    root = createRoot(document.createElement('div'))
    act(() => root.render(<Subscriber />))
    const initialRenders = renders
    act(() => setActivityTerminalPortals([{ ...descriptor, paneKey: 'tab-a:leaf-b' }]))
    expect(renders).toBe(initialRenders + 1)
  })
})

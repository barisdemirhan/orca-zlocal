// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RetainedPaneHost } from './RetainedPaneHost'
import { registerTabGroupBody } from './tab-group-body-geometry'
import { PaneManager } from '@/lib/pane-manager/pane-manager'
import { Terminal } from '@xterm/headless'
import { captureInsertionTarget, insertText } from '../dictation/dictation-insertion-target'
import { returnRetainedPaneDestinationHome } from './retained-pane-destinations'

const disconnect = vi.fn()
const observerCreated = vi.fn()
let notifyResize: () => void
let anchors: HTMLDivElement[]
let unregisterAnchors: (() => void)[]

beforeEach(() => {
  vi.stubGlobal('__ORCA_WEB_CLIENT__', true)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        notifyResize = callback
        observerCreated()
      }
      observe(): void {}
      unobserve(): void {}
      disconnect = disconnect
    }
  )
  disconnect.mockClear()
  observerCreated.mockClear()
  anchors = ['left', 'right'].map((id, index) => {
    const anchor = document.createElement('div')
    anchor.dataset.tabGroupBodyId = id
    anchor.getBoundingClientRect = () => new DOMRect(index * 400, 32, 400, 568)
    document.body.append(anchor)
    return anchor
  })
  unregisterAnchors = ['left', 'right'].map((id, index) => registerTabGroupBody(id, anchors[index]))
})

afterEach(() => {
  cleanup()
  unregisterAnchors.forEach((unregister) => unregister())
  anchors.forEach((anchor) => anchor.remove())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('retains pane content across group moves and visibility changes using measured browser bounds', () => {
  const focus = vi.fn()
  const content = <input defaultValue="draft" />
  const view = render(
    <RetainedPaneHost groupId="left" isVisible onFocusOwningGroup={focus}>
      {content}
    </RetainedPaneHost>
  )
  const host = view.container.firstElementChild as HTMLDivElement
  const input = view.getByRole('textbox')
  expect(host.style.top).toBe('32px')
  expect(host.style.width).toBe('400px')
  fireEvent.change(input, { target: { value: 'unsent draft' } })

  view.rerender(
    <RetainedPaneHost groupId="right" isVisible onFocusOwningGroup={focus}>
      {content}
    </RetainedPaneHost>
  )
  expect(host.style.left).toBe('400px')
  expect(view.getByRole('textbox')).toBe(input)
  expect((input as HTMLInputElement).value).toBe('unsent draft')
  fireEvent.pointerDown(input)
  expect(focus).toHaveBeenLastCalledWith('right')

  anchors[1].getBoundingClientRect = () => new DOMRect(450, 32, 350, 500)
  act(() => notifyResize())
  expect(host.style.left).toBe('450px')
  expect(host.style.width).toBe('350px')

  view.rerender(
    <RetainedPaneHost groupId="right" isVisible={false}>
      {content}
    </RetainedPaneHost>
  )
  expect(host.style.display).toBe('none')
  expect(host.hasAttribute('inert')).toBe(true)
  expect(host.contains(input)).toBe(true)
  view.rerender(
    <RetainedPaneHost groupId="right" isVisible>
      {content}
    </RetainedPaneHost>
  )
  expect(host.style.display).toBe('flex')
  expect(host.hasAttribute('inert')).toBe(false)
  expect(view.getByRole('textbox')).toBe(input)
  view.unmount()
  expect(disconnect).toHaveBeenCalled()
})

it('allows hidden terminal startup measurement without exposing input or starting fit timers for chat', () => {
  const timeout = vi.spyOn(window, 'setTimeout')
  const view = render(
    <RetainedPaneHost groupId="left" isVisible={false} measureWhileHidden>
      <input />
    </RetainedPaneHost>
  )
  const host = view.container.firstElementChild as HTMLDivElement
  expect(host.style.display).toBe('flex')
  expect(host.style.opacity).toBe('0')
  expect(host.style.pointerEvents).toBe('none')
  expect(host.hasAttribute('inert')).toBe(true)
  view.rerender(
    <RetainedPaneHost groupId="left" isVisible>
      <input />
    </RetainedPaneHost>
  )
  expect(timeout).not.toHaveBeenCalled()
  timeout.mockRestore()
})

function countResizeListeners(spy: ReturnType<typeof vi.spyOn>): number {
  return spy.mock.calls.filter(([type]) => type === 'resize').length
}

it('measures a group once for all of its visible panes', () => {
  const addListener = vi.spyOn(window, 'addEventListener')
  const view = render(
    <>
      <RetainedPaneHost groupId="left" isVisible>
        <span />
      </RetainedPaneHost>
      <RetainedPaneHost groupId="left" isVisible>
        <span />
      </RetainedPaneHost>
      <RetainedPaneHost groupId="left" isVisible>
        <span />
      </RetainedPaneHost>
    </>
  )
  expect(observerCreated).toHaveBeenCalledTimes(1)
  expect(countResizeListeners(addListener)).toBe(1)

  const measureBody = vi.fn(() => new DOMRect(0, 40, 300, 500))
  anchors[0].getBoundingClientRect = measureBody
  act(() => notifyResize())
  expect(measureBody).toHaveBeenCalledTimes(1)
  const hosts = Array.from(view.container.querySelectorAll<HTMLElement>('.isolate'))
  expect(hosts.map((host) => host.style.width)).toEqual(['300px', '300px', '300px'])

  const removeListener = vi.spyOn(window, 'removeEventListener')
  view.unmount()
  expect(disconnect).toHaveBeenCalledTimes(1)
  expect(countResizeListeners(removeListener)).toBe(1)
})

it('does not measure a hidden pane until it becomes visible', () => {
  const addListener = vi.spyOn(window, 'addEventListener')
  const view = render(
    <RetainedPaneHost groupId="left" isVisible={false}>
      <span />
    </RetainedPaneHost>
  )
  const host = view.container.firstElementChild as HTMLDivElement
  expect(observerCreated).not.toHaveBeenCalled()
  expect(countResizeListeners(addListener)).toBe(0)
  expect(host.style.display).toBe('none')

  anchors[0].getBoundingClientRect = () => new DOMRect(0, 48, 320, 400)
  view.rerender(
    <RetainedPaneHost groupId="left" isVisible>
      <span />
    </RetainedPaneHost>
  )
  expect(observerCreated).toHaveBeenCalledTimes(1)
  expect(host.style.top).toBe('48px')
  expect(host.style.width).toBe('320px')

  view.rerender(
    <RetainedPaneHost groupId="left" isVisible={false}>
      <span />
    </RetainedPaneHost>
  )
  expect(disconnect).toHaveBeenCalledTimes(1)
})

it('keeps measuring a hidden pane that asks to measure while hidden', () => {
  const view = render(
    <RetainedPaneHost groupId="left" isVisible={false} measureWhileHidden>
      <span />
    </RetainedPaneHost>
  )
  const host = view.container.firstElementChild as HTMLDivElement
  expect(observerCreated).toHaveBeenCalledTimes(1)
  expect(host.style.width).toBe('400px')
  anchors[0].getBoundingClientRect = () => new DOMRect(0, 32, 360, 568)
  act(() => notifyResize())
  expect(host.style.width).toBe('360px')
})

it('mounts its pane only once the host sits at the measured group body', () => {
  const geometryAtMount: string[] = []
  function MeasuringChild(): React.JSX.Element {
    const ref = useRef<HTMLSpanElement | null>(null)
    // A terminal pane creates and fits xterm in its own layout effect, before the host's.
    useLayoutEffect(() => {
      const host = ref.current?.parentElement
      geometryAtMount.push(`${host?.style.top} ${host?.style.width}`)
    }, [])
    return <span ref={ref} />
  }
  anchors[0].getBoundingClientRect = () => new DOMRect(1, 36, 449, 800)
  render(
    <RetainedPaneHost groupId="left" isVisible>
      <MeasuringChild />
    </RetainedPaneHost>
  )
  expect(geometryAtMount).toEqual(['36px 449px'])
})

it('mounts a pane at once when it has no group body to measure', () => {
  const view = render(
    <RetainedPaneHost groupId="missing" isVisible>
      <input />
    </RetainedPaneHost>
  )
  expect(view.getByRole('textbox')).toBeTruthy()
})

it('preserves the manager, xterm, PTY binding and dictation target through 100 destination round trips', () => {
  const cleanupMount = vi.fn()
  const managers: PaneManager[] = []
  const terminals: Terminal[] = []
  const ptyBindings: object[] = []
  function TerminalOwner(): React.JSX.Element {
    const ref = useRef<HTMLDivElement>(null)
    useEffect(() => {
      if (!ref.current) {
        throw new Error('Terminal root missing')
      }
      const manager = new PaneManager(ref.current, { linkOpenHint: () => '' })
      const terminal = new Terminal({ cols: 80, rows: 24 })
      const binding = { ptyId: 'worktree-a@@retained-pty' }
      managers.push(manager)
      terminals.push(terminal)
      ptyBindings.push(binding)
      return () => {
        cleanupMount()
        manager.destroy()
        terminal.dispose()
      }
    }, [])
    return (
      <div ref={ref} data-terminal-tab-id="tab-retained">
        <div
          className="pane"
          data-pane-id="7"
          data-leaf-id="leaf-retained"
          data-pty-id="worktree-a@@retained-pty"
        >
          <textarea className="xterm-helper-textarea" />
        </div>
      </div>
    )
  }
  const mirror = document.createElement('div')
  const activity = document.createElement('div')
  document.body.append(mirror, activity)
  const renderHost = (destination: HTMLElement | null, groupId = 'left') => (
    <RetainedPaneHost
      groupId={groupId}
      isVisible={!destination}
      retainContent
      destination={destination}
    >
      <TerminalOwner />
    </RetainedPaneHost>
  )
  const view = render(renderHost(null))
  const home = view.container.firstElementChild
  const root = view.container.querySelector('[data-terminal-tab-id]')
  const textarea = view.getByRole('textbox')
  textarea.focus()
  const captured = captureInsertionTarget()
  const insertion = vi.fn()
  document.addEventListener('dictation:insertText', insertion)
  for (let index = 0; index < 100; index++) {
    view.rerender(renderHost(index % 2 ? activity : mirror))
    expect((index % 2 ? activity : mirror).contains(root)).toBe(true)
    view.rerender(renderHost(null, index % 2 ? 'left' : 'right'))
    expect(home?.contains(root)).toBe(true)
  }
  expect(managers).toHaveLength(1)
  expect(terminals).toHaveLength(1)
  expect(ptyBindings).toEqual([{ ptyId: 'worktree-a@@retained-pty' }])
  expect(cleanupMount).not.toHaveBeenCalled()
  expect(captured).toMatchObject({ kind: 'terminal', tabId: 'tab-retained' })
  textarea.focus()
  expect(captureInsertionTarget()).toEqual(captured)
  if (!captured) {
    throw new Error('Dictation origin missing')
  }
  insertText('retained origin', captured)
  expect(insertion.mock.calls[0][0].detail).toMatchObject({
    text: 'retained origin',
    tabId: 'tab-retained'
  })
  view.rerender(renderHost(mirror))
  returnRetainedPaneDestinationHome(mirror)
  expect(home?.contains(root)).toBe(true)
  mirror.remove()
  view.rerender(renderHost(null))
  expect(cleanupMount).not.toHaveBeenCalled()
  view.unmount()
  expect(cleanupMount).toHaveBeenCalledOnce()
  document.removeEventListener('dictation:insertText', insertion)
  activity.remove()
})

it('emits the original host attribute and direct children when retention is off', () => {
  const { container, rerender } = render(
    <RetainedPaneHost groupId={undefined} isVisible retainContent={false}>
      <span data-baseline-child>original content</span>
    </RetainedPaneHost>
  )
  const host = container.firstElementChild
  expect(host?.getAttribute('data-retained-pane-host')).toBe('')
  expect(host?.innerHTML).toBe('<span data-baseline-child="true">original content</span>')
  rerender(
    <RetainedPaneHost groupId={undefined} isVisible={false} retainContent={false}>
      <span data-baseline-child>original content</span>
    </RetainedPaneHost>
  )
  expect(host?.getAttribute('data-retained-pane-host')).toBe('')
  expect(host?.getAttribute('aria-hidden')).toBe('true')
  expect(host?.innerHTML).toBe('<span data-baseline-child="true">original content</span>')
})

import type * as MirrorSource from './agent-hub-mirror-source'
import { mirrorWindowIdFor } from './agent-hub-mirror-test-fixtures'
/** @vitest-environment happy-dom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({
      sidebarOpen: false,
      sidebarWidth: 280,
      rightSidebarOpen: false,
      rightSidebarWidth: 350,
      statusBarVisible: false,
      settings: { agentHubCanvas: true, agentHubFloatingLayout: 'grid' }
    }))
  }
})

import { makeTabWithIds, makeWorktree } from './agent-hub-activity-test-fixtures'
import {
  agentHubWorkArea,
  arrangeAgentHubFloatingWindowsOnScreen,
  requestAgentHubMirrorPlacement
} from './agent-hub-floating-arrangement'
import { isAgentHubMirrorFocusEscape, readAgentHubMirrorFocus } from './agent-hub-mirror-focus'
import {
  agentHubMirrorFocusGeometry,
  type AgentHubMirrorGeometry
} from './agent-hub-mirror-geometry'
import { readAgentHubMirrorOrigin, rememberAgentHubMirrorOrigin } from './agent-hub-mirror-places'
import {
  openAgentHubMirror,
  resetAgentHubMirrorsForTest,
  toggleAgentHubMirrorFocus
} from './agent-hub-mirror-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { useMirrorWindowGeometry } from './use-mirror-window-geometry'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const OWN_PLACE: AgentHubMirrorGeometry = { x: 24, y: 60, width: 480, height: 300 }

let root: Root | null = null
let host: HTMLDivElement | null = null

afterEach(() => {
  act(() => root?.unmount())
  root = null
  host?.remove()
  host = null
  resetAgentHubMirrorsForTest()
})

function target(tabId: string): AgentHubPaneTarget {
  const worktree = makeWorktree()
  return {
    worktree,
    repo: null,
    tab: makeTabWithIds(tabId, worktree.id),
    paneKey: `${tabId}:leaf`,
    title: tabId,
    agentType: 'claude'
  }
}

type Shown = ReturnType<typeof useMirrorWindowGeometry>

/** Mounts one mirror's geometry per key, each opened at OWN_PLACE; returns what each shows. */
function renderMirrors(keys: readonly string[]): (key: string) => Shown {
  const shown = new Map<string, Shown>()
  function Mirror({ mirrorKey }: { mirrorKey: string }): React.JSX.Element {
    const geometry = useMirrorWindowGeometry(mirrorKey, false)
    shown.set(mirrorKey, geometry)
    return (
      <section
        ref={geometry.sectionRef}
        data-agent-hub-mirror
        data-agent-hub-mirror-key={mirrorKey}
      />
    )
  }
  for (const key of keys) {
    openAgentHubMirror(target(key.replace(':leaf', '')))
    rememberAgentHubMirrorOrigin(mirrorWindowIdFor(key), OWN_PLACE)
  }
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  act(() =>
    root?.render(keys.map((key) => <Mirror key={key} mirrorKey={mirrorWindowIdFor(key)} />))
  )
  return (key) => {
    const current = shown.get(mirrorWindowIdFor(key))
    if (!current) {
      throw new Error(`No mirror rendered for ${key}`)
    }
    return current
  }
}

function focusBox(): AgentHubMirrorGeometry {
  return agentHubMirrorFocusGeometry(agentHubWorkArea(), {
    width: window.innerWidth,
    height: window.innerHeight
  })
}

describe('a focused mirror window', () => {
  it('keeps a work-area-clamped detach smaller than the usual minimum when applying its place', () => {
    const shown = renderMirrors(['tab-a:leaf'])
    const placement = { x: 280, y: 40, width: 300, height: 200 }
    act(() => requestAgentHubMirrorPlacement(mirrorWindowIdFor('tab-a:leaf'), placement))
    expect(shown('tab-a:leaf').geometry).toEqual(placement)
    expect(readAgentHubMirrorOrigin(mirrorWindowIdFor('tab-a:leaf'))).toEqual(placement)
  })
  it('shows in the focus box, gliding there, with the others in shadow', () => {
    const shown = renderMirrors(['tab-a:leaf', 'tab-b:leaf'])
    expect(shown('tab-a:leaf')).toMatchObject({ geometry: OWN_PLACE, focus: null })

    act(() => toggleAgentHubMirrorFocus(mirrorWindowIdFor('tab-a:leaf')))

    expect(focusBox()).not.toEqual(OWN_PLACE)
    expect(shown('tab-a:leaf')).toMatchObject({
      geometry: focusBox(),
      focus: 'focused',
      settling: true
    })
    expect(shown('tab-b:leaf')).toMatchObject({ geometry: OWN_PLACE, focus: 'shadowed' })
  })

  it('glides by transform from the old box when focus starts or ends, not by resizing', () => {
    const animate = vi.fn((_frames: Keyframe[], _options?: KeyframeAnimationOptions) => ({
      cancel: () => {}
    }))
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true })
    try {
      renderMirrors(['tab-a:leaf'])
      expect(animate).not.toHaveBeenCalled()
      act(() => toggleAgentHubMirrorFocus(mirrorWindowIdFor('tab-a:leaf')))
      expect(animate).toHaveBeenCalledTimes(1)
      const frames = animate.mock.calls[0]?.[0]
      // The origin rides in the keyframes: an inline one is cleared by the last glide's cancel.
      expect(frames?.[0]).toMatchObject({ transformOrigin: '0 0' })
      expect(frames?.[1]).toEqual({ transform: 'none', transformOrigin: '0 0' })
      act(() => toggleAgentHubMirrorFocus(mirrorWindowIdFor('tab-a:leaf')))
      expect(animate).toHaveBeenCalledTimes(2)
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, 'animate')
    }
  })

  it('does not glide under reduced motion', () => {
    const animate = vi.fn((_frames: Keyframe[], _options?: KeyframeAnimationOptions) => ({
      cancel: () => {}
    }))
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true })
    const matchMedia = vi.fn(() => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {}
    }))
    vi.stubGlobal('matchMedia', matchMedia)
    try {
      renderMirrors(['tab-a:leaf'])
      act(() => toggleAgentHubMirrorFocus(mirrorWindowIdFor('tab-a:leaf')))
      expect(animate).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
      Reflect.deleteProperty(HTMLElement.prototype, 'animate')
    }
  })

  it('keeps its own place stored while focused, and returns to exactly that box', () => {
    const shown = renderMirrors(['tab-a:leaf', 'tab-b:leaf'])

    act(() => toggleAgentHubMirrorFocus(mirrorWindowIdFor('tab-a:leaf')))
    expect(readAgentHubMirrorOrigin(mirrorWindowIdFor('tab-a:leaf'))).toEqual(OWN_PLACE)

    act(() => toggleAgentHubMirrorFocus(mirrorWindowIdFor('tab-a:leaf')))
    expect(shown('tab-a:leaf')).toMatchObject({ geometry: OWN_PLACE, focus: null })
    expect(shown('tab-b:leaf')).toMatchObject({ geometry: OWN_PLACE, focus: null })
    expect(readAgentHubMirrorOrigin(mirrorWindowIdFor('tab-a:leaf'))).toEqual(OWN_PLACE)
  })

  it('ends the focus when the windows are arranged, and takes its arranged place', () => {
    const shown = renderMirrors(['tab-a:leaf', 'tab-b:leaf'])
    act(() => toggleAgentHubMirrorFocus(mirrorWindowIdFor('tab-a:leaf')))

    act(() => arrangeAgentHubFloatingWindowsOnScreen('columns'))

    expect(readAgentHubMirrorFocus()).toBeNull()
    const [left, right] = [shown('tab-a:leaf').geometry, shown('tab-b:leaf').geometry].toSorted(
      (a, b) => a.x - b.x
    )
    expect(shown('tab-a:leaf').focus).toBeNull()
    expect(left?.width).toBe(right?.width)
    expect(left && right ? left.x + left.width <= right.x : false).toBe(true)
  })
})

describe('Escape while a mirror is focused', () => {
  function escapeOn(markup: string, selector: string): boolean {
    host = document.createElement('div')
    host.innerHTML = markup
    document.body.append(host)
    let verdict = false
    const onKeyDown = (event: KeyboardEvent): void => {
      verdict = isAgentHubMirrorFocusEscape(event)
    }
    window.addEventListener('keydown', onKeyDown)
    const element = selector === 'body' ? document.body : host.querySelector(selector)
    element?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    window.removeEventListener('keydown', onKeyDown)
    return verdict
  }

  it("ends the focus from the canvas, a mirror's chrome, or with nothing focused", () => {
    expect(escapeOn('<div data-agent-hub-canvas><button></button></div>', 'button')).toBe(true)
    expect(escapeOn('<section data-agent-hub-mirror><button></button></section>', 'button')).toBe(
      true
    )
    expect(escapeOn('', 'body')).toBe(true)
  })

  it('stays with the terminal it was typed in, and with the hub panel', () => {
    expect(
      escapeOn(
        '<section data-agent-hub-mirror><div class="xterm"><textarea></textarea></div></section>',
        'textarea'
      )
    ).toBe(false)
    expect(escapeOn('<div data-agent-hub-panel><input /></div>', 'input')).toBe(false)
  })
})

vi.mock('./agent-hub-mirror-source', async (original) => ({
  ...(await original<typeof MirrorSource>()),
  resolveAgentHubMirrorTarget: (
    target: Parameters<typeof MirrorSource.resolveAgentHubMirrorTarget>[0]
  ) => target
}))

/** @vitest-environment happy-dom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import {
  setFloatingWindowsSpotlit,
  useAnyFloatingWindowOpen,
  useFloatingWindowPresence,
  useFloatingWindowsSpotlit
} from './agent-hub-floating-dim'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const roots: Root[] = []

afterEach(() => {
  act(() => roots.forEach((root) => root.unmount()))
  roots.length = 0
})

function mount(element: React.JSX.Element): Root {
  const root = createRoot(document.createElement('div'))
  roots.push(root)
  act(() => root.render(element))
  return root
}

function FloatingWindow({ showing }: { showing: boolean }): null {
  useFloatingWindowPresence(showing)
  return null
}

describe('floating window presence', () => {
  it('counts a window only while it shows, so a closed panel does not keep the dim up', () => {
    let anyOpen = false
    function Backdrop(): null {
      anyOpen = useAnyFloatingWindowOpen()
      return null
    }
    mount(<Backdrop />)
    const panel = mount(<FloatingWindow showing={false} />)
    expect(anyOpen).toBe(false)

    act(() => panel.render(<FloatingWindow showing />))
    expect(anyOpen).toBe(true)

    const mirror = mount(<FloatingWindow showing />)
    act(() => panel.render(<FloatingWindow showing={false} />))
    expect(anyOpen).toBe(true)

    act(() => mirror.unmount())
    expect(anyOpen).toBe(false)
  })

  it('brings the dim back when a window opens after a click behind the windows lifted it', () => {
    let spotlit = true
    function Backdrop(): null {
      spotlit = useFloatingWindowsSpotlit()
      return null
    }
    mount(<Backdrop />)
    act(() => setFloatingWindowsSpotlit(false))
    expect(spotlit).toBe(false)

    mount(<FloatingWindow showing />)
    expect(spotlit).toBe(true)
  })
})

/** @vitest-environment happy-dom */
import { expect, it } from 'vitest'
import { agentHubMirrorPointerSelection } from './agent-hub-mirror-pointer-selection'

function build(): {
  slot: HTMLElement
  xterm: HTMLElement
  button: HTMLElement
  input: HTMLElement
  tab: HTMLElement
} {
  const root = document.createElement('div')
  root.innerHTML = `<button id="tab"></button>
    <div data-agent-hub-mirror-slot><div class="xterm"><canvas></canvas></div><button id="b"></button><input id="i" /></div>`
  const get = (selector: string): HTMLElement => {
    const found = root.querySelector<HTMLElement>(selector)
    if (!found) {
      throw new Error(selector)
    }
    return found
  }
  return {
    slot: get('[data-agent-hub-mirror-slot]'),
    xterm: get('canvas'),
    button: get('#b'),
    input: get('#i'),
    tab: get('#tab')
  }
}

it('focuses the terminal for a click inside xterm, active or not', () => {
  const { xterm } = build()
  expect(agentHubMirrorPointerSelection(xterm, true)).toEqual({ focusTerminal: true })
  expect(agentHubMirrorPointerSelection(xterm, false)).toEqual({ focusTerminal: true })
})

it('leaves an already active pane alone when its own chrome is clicked', () => {
  expect(agentHubMirrorPointerSelection(build().button, true)).toBeNull()
})

it('selects an inactive pane from its chrome, without stealing focus from an input', () => {
  const { button, input } = build()
  expect(agentHubMirrorPointerSelection(button, false)).toEqual({ focusTerminal: true })
  expect(agentHubMirrorPointerSelection(input, false)).toEqual({ focusTerminal: false })
})

it('selects without terminal focus for a click outside the slot', () => {
  const { tab } = build()
  expect(agentHubMirrorPointerSelection(tab, true)).toEqual({ focusTerminal: false })
  expect(agentHubMirrorPointerSelection(null, false)).toEqual({ focusTerminal: false })
})

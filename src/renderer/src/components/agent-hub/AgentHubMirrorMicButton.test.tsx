/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentHubMirrorMicState } from './agent-hub-mirror-mic-state'
import { TooltipProvider } from '../ui/tooltip'
import { AgentHubMirrorMicButton } from './AgentHubMirrorMicButton'
import {
  makeRepo,
  makeTabWithIds,
  makeWorktree
} from '../activity/ActivityPrototypePage-test-fixtures'

const control = vi.hoisted(() => {
  const initial: { state: AgentHubMirrorMicState } = { state: 'idle' }
  return initial
})
vi.mock('./use-agent-hub-mirror-mic-state', () => ({
  useAgentHubMirrorMicState: () => control.state
}))
vi.mock('./agent-hub-dictation-origin', () => ({ useAgentHubDictationSession: () => null }))
vi.mock('@/store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      settings: { voice: { enabled: true } },
      modelStates: [],
      refreshModelStates: () => Promise.resolve()
    })
}))
vi.mock('./agent-hub-voice-settings', () => ({
  openAgentHubVoiceSettings: vi.fn(),
  toggleAgentHubVoiceDictation: vi.fn(),
  updateAgentHubVoiceSettings: vi.fn()
}))
vi.mock('./use-menu-opening-click-guard', () => ({
  useMenuOpeningClickGuard: () => ({ noteOpenChange: vi.fn(), isOpeningClick: () => false })
}))
const actions: unknown[] = []
let improve = false
const capabilities = (event: Event) => {
  if (event instanceof CustomEvent) {
    event.detail.cancel = true
    if (improve) {
      event.detail.improve = true
    }
  }
}
const receive = (event: Event) => {
  if (event instanceof CustomEvent) {
    actions.push(event.detail)
  }
}
beforeEach(() => {
  control.state = 'idle'
  improve = false
  actions.length = 0
  document.addEventListener('dictation:capabilities', capabilities)
  document.addEventListener('dictation:control', receive)
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { speech: { getCatalog: () => Promise.resolve([]) } }
  })
})
afterEach(() => {
  cleanup()
  document.removeEventListener('dictation:capabilities', capabilities)
  document.removeEventListener('dictation:control', receive)
})
function mount() {
  const worktree = makeWorktree()
  const target = {
    tab: makeTabWithIds('mic-tab', worktree.id),
    worktree,
    repo: makeRepo(),
    paneKey: null,
    title: 'Audit terminal',
    agentType: null
  }
  return render(
    <TooltipProvider>
      <div data-agent-hub-mirror>
        <textarea className="xterm-helper-textarea" aria-label="Terminal input" />
        <AgentHubMirrorMicButton target={target} reachable />
      </div>
    </TooltipProvider>
  )
}
const mic = () => document.querySelector<HTMLButtonElement>('[data-agent-hub-mirror-mic]')!

describe('mirror mic improvement capability', () => {
  it('keeps legacy Shift-click plain and hides the improve menu item', async () => {
    mount()
    fireEvent.click(mic(), { shiftKey: true })
    expect(actions).toEqual(['start'])
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Terminal input' }))
    expect(mic().getAttribute('aria-label')).toBe('Dictate into this terminal')
    fireEvent.contextMenu(mic())
    await screen.findByRole('menu')
    expect(screen.queryByText('Dictate and improve')).toBeNull()
  })
  it('uses the object form for Shift-click only when supported; plain click stays plain', () => {
    improve = true
    mount()
    fireEvent.click(mic())
    fireEvent.click(mic(), { shiftKey: true })
    expect(actions).toEqual(['start', { action: 'start', improve: true }])
    expect(mic().getAttribute('aria-label')).toContain('Shift-click')
  })
  it('starts improved dictation from the menu after returning focus to the terminal', async () => {
    improve = true
    mount()
    fireEvent.contextMenu(mic())
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Dictate and improve' }))
    await waitFor(() => expect(actions).toEqual([{ action: 'start', improve: true }]))
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Terminal input' }))
  })
  it.each([
    'starting',
    'listening',
    'finishing',
    'elsewhere',
    'disabled',
    'no-model',
    'unsupported'
  ] as const)('disables the improve menu while %s', async (state) => {
    improve = true
    control.state = state
    mount()
    fireEvent.contextMenu(mic())
    expect(
      (await screen.findByRole('menuitem', { name: 'Dictate and improve' })).getAttribute(
        'aria-disabled'
      )
    ).toBe('true')
    expect(actions).toEqual([])
  })
  it('rechecks the capability before dispatch and falls back to the legacy form', () => {
    improve = true
    mount()
    improve = false
    fireEvent.click(mic(), { shiftKey: true })
    expect(actions).toEqual(['start'])
  })
})

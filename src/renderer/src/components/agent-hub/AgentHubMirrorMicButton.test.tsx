/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentHubMirrorMicState } from './agent-hub-mirror-mic-state'
import { useAppStore } from '@/store'
import { TooltipProvider } from '../ui/tooltip'
import { AgentHubMirrorMicButton } from './AgentHubMirrorMicButton'
import { openAgentHubVoiceSettings } from './agent-hub-voice-settings'
import { makeRepo, makeTabWithIds, makeWorktree } from './agent-hub-activity-test-fixtures'

const control = vi.hoisted(() => {
  const initial: { state: AgentHubMirrorMicState } = { state: 'idle' }
  return initial
})
vi.mock('./use-agent-hub-mirror-mic-state', () => ({
  useAgentHubMirrorMicState: () => control.state
}))
vi.mock('./agent-hub-dictation-origin', () => ({ useAgentHubDictationSession: () => null }))
vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  const useAppStore = create(() => ({
    settings: { voice: { enabled: true }, agentHubMicMode: 'dictate' },
    terminalLayoutsByTabId: {},
    modelStates: [],
    keybindings: {},
    refreshModelStates: () => Promise.resolve(),
    updateSettings: vi.fn(async (updates: { agentHubMicMode?: string }) => {
      useAppStore.setState((s) => ({ settings: { ...s.settings, ...updates } }))
    })
  }))
  return { useAppStore }
})
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
function setMode(mode: 'dictate' | 'improve'): void {
  const settings = useAppStore.getState().settings
  if (!settings) {
    throw new Error('Missing test settings')
  }
  useAppStore.setState({ settings: { ...settings, agentHubMicMode: mode } })
}

beforeEach(() => {
  setMode('dictate')
  useAppStore.setState({ keybindings: {} })
  vi.clearAllMocks()
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
        <div data-terminal-tab-id="mic-tab">
          <div className="pane" data-leaf-id="leaf">
            <textarea className="xterm-helper-textarea" aria-label="Terminal input" />
          </div>
        </div>
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
    expect(screen.queryByRole('menuitemcheckbox', { name: 'Improve with an agent' })).toBeNull()
  })
  it('ignores an earlier input belonging to another entry', () => {
    const view = mount()
    const other = document.createElement('textarea')
    other.className = 'xterm-helper-textarea'
    view.container.querySelector('[data-agent-hub-mirror]')?.prepend(other)
    fireEvent.click(mic())
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Terminal input' }))
    expect(actions).toEqual(['start'])
  })
  it('uses the object form for Shift-click only when supported; plain click stays plain', () => {
    improve = true
    mount()
    fireEvent.click(mic())
    fireEvent.click(mic(), { shiftKey: true })
    expect(actions).toEqual(['start', { action: 'start', improve: true }])
    expect(mic().getAttribute('aria-label')).toContain('Shift-click')
  })
  it('chooses a persisted default without starting dictation, updates its microphone icon, and Shift-click uses the other mode', async () => {
    improve = true
    mount()
    expect(mic().querySelector('.lucide-mic')).not.toBeNull()
    fireEvent.contextMenu(mic())
    const better = await screen.findByRole('menuitemcheckbox', { name: 'Improve with an agent' })
    expect(better.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(better)
    await waitFor(() => expect(useAppStore.getState().settings?.agentHubMicMode).toBe('improve'))
    expect(actions).toEqual([])
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(better.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(better)
    expect(useAppStore.getState().settings?.agentHubMicMode).toBe('dictate')
    fireEvent.click(better)
    expect(mic().querySelector('.lucide-mic-vocal')).not.toBeNull()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    fireEvent.click(mic())
    fireEvent.click(mic(), { shiftKey: true })
    expect(actions).toEqual([{ action: 'start', improve: true }, 'start'])
  })
  it('uses plain dictation when the saved improve mode is unsupported without rewriting it', () => {
    setMode('improve')
    mount()
    expect(mic().getAttribute('data-agent-hub-mic-mode')).toBe('dictate')
    expect(mic().querySelector('.lucide-mic')).not.toBeNull()
    fireEvent.click(mic())
    fireEvent.click(mic(), { shiftKey: true })
    expect(actions).toEqual(['start', 'start'])
    expect(useAppStore.getState().settings?.agentHubMicMode).toBe('improve')
  })
  it('can choose a default while listening without starting or stopping the session', async () => {
    improve = true
    control.state = 'listening'
    mount()
    fireEvent.contextMenu(mic())
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Improve with an agent' }))
    expect(actions).toEqual([])
    expect(mic().getAttribute('data-agent-hub-mirror-mic')).toBe('listening')
  })
  it('shows only the bound shortcut for the selected default at the row edge', async () => {
    improve = true
    useAppStore.setState({
      keybindings: { 'voice.dictation': ['Mod+F7'] }
    })
    mount()
    fireEvent.contextMenu(mic())
    const row = (await screen.findByRole('menuitemcheckbox', { name: 'Improve with an agent' }))
      .parentElement!
    expect(row.textContent).toContain('F7')
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Improve with an agent' }))
    expect(row.textContent).not.toContain('F7')
    await waitFor(() => expect(row.querySelector('[data-slot="context-menu-shortcut"]')).toBeNull())
  })
  it('opens Voice settings from the gear without starting dictation', async () => {
    improve = true
    mount()
    fireEvent.contextMenu(mic())
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Improve transcription settings' }))
    expect(openAgentHubVoiceSettings).toHaveBeenCalledOnce()
    expect(actions).toEqual([])
    expect(useAppStore.getState().settings?.agentHubMicMode).toBe('dictate')
  })
  it('rechecks the capability before dispatch and falls back to the legacy form', () => {
    improve = true
    mount()
    improve = false
    fireEvent.click(mic(), { shiftKey: true })
    expect(actions).toEqual(['start'])
  })
})

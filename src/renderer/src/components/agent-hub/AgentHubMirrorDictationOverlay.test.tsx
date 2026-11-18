/** @vitest-environment happy-dom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import {
  getDefaultSettings,
  getDefaultVoiceSettings
} from '../../../../shared/orca-profiles/constants'
import { makeTabWithIds, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
import { TooltipProvider } from '../ui/tooltip'
import { AgentHubMirrorDictationOverlay } from './AgentHubMirrorDictationOverlay'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({
      keybindings: {},
      liveText: { committed: '', tentative: '', speechPending: false },
      dictationState: 'listening',
      settings: { voice: { dictationMode: 'toggle' } }
    }))
  }
})
vi.mock('./use-agent-hub-mirror-mic-state', () => ({
  useAgentHubMirrorMicState: () => 'listening'
}))

afterEach(cleanup)

const worktree = makeWorktree()
const target: AgentHubPaneTarget = {
  worktree,
  repo: null,
  tab: makeTabWithIds('tab-1', worktree.id),
  paneKey: null,
  title: 'Terminal',
  agentType: null
}

it.each([
  { mode: 'toggle', shown: true },
  { mode: 'hold', shown: false }
] as const)('shows the stop shortcut on the pill in $mode mode: $shown', ({ mode, shown }) => {
  const settings = getDefaultSettings('/home/u')
  useAppStore.setState({
    settings: { ...settings, voice: { ...getDefaultVoiceSettings(), dictationMode: mode } }
  })
  render(
    <TooltipProvider>
      <AgentHubMirrorDictationOverlay target={target} showsTerminal />
    </TooltipProvider>
  )
  const hint = document.querySelector('[data-agent-hub-dictation-stop-key]')
  expect(hint !== null).toBe(shown)
  if (shown) {
    expect(hint?.textContent).toMatch(/E.*to stop/)
  }
  expect(screen.getByRole('button', { name: 'Stop dictation' })).toBeTruthy()
})

/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { createGlobalSettingsFixture } from '../../../../shared/global-settings-test-fixture'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { KeybindingActionId, KeybindingOverrides } from '../../../../shared/keybindings'
import { TooltipProvider } from '../ui/tooltip'
import { AgentHubSettingsPane } from './AgentHubSettingsPane'
import { AgentHubExperimentalSetting } from './AgentHubExperimentalSetting'
import { callStructuredAgentSession } from '@/runtime/structured-agent-session-client'
import { ensureLocalRuntimeCapabilities } from '@/runtime/local-runtime-capabilities'
import { resetHostStructuredAgentsForTests } from '@/runtime/host-structured-agents'
import { resetHostModelCatalogSnapshotsForTests } from '@/runtime/host-model-catalog-snapshots'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  const { createGlobalSettingsFixture } =
    await import('../../../../shared/global-settings-test-fixture')
  const keybindings: KeybindingOverrides = {}
  const useAppStore = create(() => ({
    settings: createGlobalSettingsFixture({ experimentalAgentHub: true }),
    keybindings,
    keybindingSnapshot: null,
    settingsSearchQuery: '',
    openSettingsTarget: vi.fn(),
    updateSettings: vi.fn(async (updates: Partial<GlobalSettings>) => {
      useAppStore.setState((state) => ({ settings: { ...state.settings, ...updates } }))
    }),
    setKeybindingOverride: vi.fn(async (id: KeybindingActionId, bindings: string[]) => {
      useAppStore.setState((state) => ({ keybindings: { ...state.keybindings, [id]: bindings } }))
    }),
    resetKeybindingOverride: vi.fn()
  }))
  return { useAppStore }
})
vi.mock('@/store/plugin-panels', () => ({ useEditablePluginCommands: () => [] }))
vi.mock('../settings/use-mac-captured-digit-chords', () => ({
  useMacCapturedDigitChords: () => []
}))
vi.mock('@/runtime/runtime-rpc-client', () => ({
  callRuntimeRpc: vi.fn(async () => ({ agents: [{ agent: 'custom-acp', capabilities: {} }] }))
}))
vi.mock('@/runtime/structured-agent-session-client', () => ({
  callStructuredAgentSession: vi.fn(async () => ({ origin: 'unknown' }))
}))
vi.mock('@/runtime/local-runtime-capabilities', async () => {
  const { AGENT_SESSION_MODEL_CATALOG_SAVED_ONLY_RUNTIME_CAPABILITY } =
    await import('../../../../shared/structured-agent-session-surface-capabilities')
  const { STRUCTURED_AGENT_SESSION_REGISTERED_AGENTS_RUNTIME_CAPABILITY } =
    await import('../../../../shared/protocol-version')
  return {
    ensureLocalRuntimeCapabilities: vi.fn(async () => [
      AGENT_SESSION_MODEL_CATALOG_SAVED_ONLY_RUNTIME_CAPABILITY,
      STRUCTURED_AGENT_SESSION_REGISTERED_AGENTS_RUNTIME_CAPABILITY
    ])
  }
})
const pickFolder = vi.fn<() => Promise<string | null>>()

beforeEach(() => {
  resetHostStructuredAgentsForTests()
  resetHostModelCatalogSnapshotsForTests()
  useAppStore.setState({
    settings: createGlobalSettingsFixture({ experimentalAgentHub: true }),
    keybindings: {}
  })
  vi.clearAllMocks()
  pickFolder.mockResolvedValue(null)
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      app: { pickFloatingWorkspaceDirectory: pickFolder },
      ui: { setShortcutRecorderFocused: vi.fn() }
    }
  })
})
afterEach(() => {
  cleanup()
  resetHostStructuredAgentsForTests()
  resetHostModelCatalogSnapshotsForTests()
})

function Pane(): React.JSX.Element {
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)
  if (!settings) {
    throw new Error('Missing test settings')
  }
  return (
    <TooltipProvider>
      <AgentHubSettingsPane settings={settings} updateSettings={updateSettings} />
    </TooltipProvider>
  )
}

it('groups the hub preferences and shares the floating workspace directory and unassigned shortcut', () => {
  render(<Pane />)
  for (const name of ['Dock', 'Alerts', 'Popover', 'Mirrors & canvas', 'Voice', 'Orb']) {
    expect(screen.getByRole('heading', { name })).toBeTruthy()
  }
  expect(screen.getByRole('combobox', { name: 'Agent' }).textContent).toContain('Claude')
  expect(screen.getByRole('combobox', { name: 'Model' }).textContent).toContain('Agent default')
  expect(screen.getByText('Working folder')).toBeTruthy()
  expect(
    screen.getByText(
      'Uses the floating workspace directory. Changes also apply to new floating tabs.'
    )
  ).toBeTruthy()
  expect(screen.getByText('~')).toBeTruthy()
  expect(screen.getByText('Not set')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Add shortcut for Talk shortcut' })).toBeTruthy()
  expect(screen.getByRole('switch', { name: 'Speak replies' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByText('Coming later')).toBeTruthy()
})

it('shows the automatic approval warning only when Act freely is selected', () => {
  render(<Pane />)
  const warning = 'The Orb runs commands without asking. Use with care.'
  expect(screen.queryByText(warning)).toBeNull()
  fireEvent.click(screen.getByRole('radio', { name: 'Act freely' }))
  expect(useAppStore.getState().settings?.agentHubOrbPermission).toBe('free')
  expect(screen.getByText(warning)).toBeTruthy()
  fireEvent.click(screen.getByRole('radio', { name: 'Ask' }))
  expect(useAppStore.getState().settings?.agentHubOrbPermission).toBe('ask')
  expect(screen.queryByText(warning)).toBeNull()
})

it('keeps the shared directory on cancellation and updates the floating workspace when chosen', async () => {
  render(<Pane />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Choose…' })))
  expect(useAppStore.getState().updateSettings).not.toHaveBeenCalled()
  pickFolder.mockResolvedValue('/project/orb')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Choose…' })))
  expect(useAppStore.getState().settings?.floatingTerminalCwd).toBe('/project/orb')
  expect(useAppStore.getState().settings?.agentHubOrbCwd).toBeNull()
  expect(screen.getByText('/project/orb')).toBeTruthy()
})

it('loads registered ACP agents with Chat UI off and clears the model pick when changing agents', async () => {
  useAppStore.getState().updateSettings({ experimentalNativeChat: false })
  useAppStore.getState().updateSettings({ agentHubOrbModel: 'old-model' })
  render(<Pane />)
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Agent' }), { key: 'ArrowDown' })
  fireEvent.click(await screen.findByRole('option', { name: 'custom-acp' }))
  expect(useAppStore.getState().settings?.agentHubOrbAgent).toBe('custom-acp')
  expect(useAppStore.getState().settings?.agentHubOrbModel).toBeNull()
  const input = await screen.findByRole('textbox', { name: 'Model' })
  fireEvent.change(input, { target: { value: 'provider/model-v2' } })
  expect(useAppStore.getState().settings?.agentHubOrbModel).toBe('provider/model-v2')
})

it('uses the host model list while preserving the unpicked agent default', async () => {
  vi.mocked(callStructuredAgentSession).mockResolvedValueOnce({
    origin: 'probe',
    fetchedAt: 100,
    models: [
      { id: 'host-model', label: 'Host model', isDefault: false, efforts: [] },
      { id: 'agent-default', label: 'Provider default alias', isDefault: false, efforts: [] }
    ]
  })
  render(<Pane />)
  await waitFor(() => expect(callStructuredAgentSession).toHaveBeenCalled())
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Model' }), { key: 'ArrowDown' })
  fireEvent.click(await screen.findByRole('option', { name: 'Host model' }))
  expect(useAppStore.getState().settings?.agentHubOrbModel).toBe('host-model')
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Model' }), { key: 'ArrowDown' })
  fireEvent.click(await screen.findByRole('option', { name: 'Agent default' }))
  expect(useAppStore.getState().settings?.agentHubOrbModel).toBeNull()
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Model' }), { key: 'ArrowDown' })
  fireEvent.click(await screen.findByRole('option', { name: 'Provider default alias' }))
  expect(useAppStore.getState().settings?.agentHubOrbModel).toBe('agent-default')
})

it('does not start a model probe on a host without saved-only catalog support', async () => {
  vi.mocked(ensureLocalRuntimeCapabilities).mockResolvedValueOnce([])
  render(<Pane />)
  await act(async () => {})
  expect(callStructuredAgentSession).not.toHaveBeenCalled()
  expect(callRuntimeRpc).not.toHaveBeenCalled()
  expect(screen.getByRole('combobox', { name: 'Model' }).textContent).toContain('Agent default')
})

it('records the Orb shortcut through the shared keybinding store', async () => {
  render(<Pane />)
  fireEvent.click(screen.getByRole('button', { name: 'Add shortcut for Toggle Agent Hub' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add shortcut for Talk shortcut' }))
  expect(
    screen.queryByRole('button', { name: /Press shortcut keys for Toggle Agent Hub/ })
  ).toBeNull()
  expect(window.api.ui.setShortcutRecorderFocused).toHaveBeenLastCalledWith(true)
  fireEvent.keyDown(screen.getByRole('button', { name: /Press shortcut keys for Talk shortcut/ }), {
    key: 'F8',
    code: 'F8',
    ctrlKey: true
  })
  await waitFor(() =>
    expect(useAppStore.getState().keybindings['agentHub.toggleOrb']).toEqual(['Mod+F8'])
  )
  expect(screen.queryByText('Not set')).toBeNull()
  expect(window.api.ui.setShortcutRecorderFocused).toHaveBeenLastCalledWith(false)
})

it('edits info alerts and offers mute durations including tomorrow at local 09:00', async () => {
  render(<Pane />)
  fireEvent.click(screen.getByRole('switch', { name: 'When an agent shares information' }))
  expect(useAppStore.getState().settings?.agentHubAlertOnInfo).toBe(false)
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Choose duration…' }), {
    button: 0,
    ctrlKey: false
  })
  expect(await screen.findByRole('menuitem', { name: '1 h' })).toBeTruthy()
  expect(screen.getByRole('menuitem', { name: '2 h' })).toBeTruthy()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)
  fireEvent.click(screen.getByRole('menuitem', { name: 'Until tomorrow at 09:00' }))
  expect(useAppStore.getState().settings?.agentHubAlertsMutedUntil).toBe(tomorrow.getTime())
})

it('edits dimming through the same four modes used by floating windows', async () => {
  render(<Pane />)
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Dim behind floating windows' }), {
    key: 'ArrowDown'
  })
  expect(await screen.findByRole('option', { name: "Don't dim" })).toBeTruthy()
  expect(screen.getByRole('option', { name: 'Dim behind floating windows' })).toBeTruthy()
  expect(screen.getByRole('option', { name: 'Dim until I click behind them' })).toBeTruthy()
  fireEvent.click(screen.getByRole('option', { name: 'Dim, and a click behind tucks them away' }))
  expect(useAppStore.getState().settings?.agentHubFloatingDimMode).toBe('minimizeOnClick')
})

it('leaves only the opt-in and navigation link in Experimental', () => {
  const settings = useAppStore.getState().settings
  if (!settings) {
    throw new Error('Missing test settings')
  }
  render(
    <AgentHubExperimentalSetting
      settings={settings}
      updateSettings={useAppStore.getState().updateSettings}
    />
  )
  expect(screen.queryByRole('heading', { name: 'Dock' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Open Agent Hub settings' }))
  expect(useAppStore.getState().openSettingsTarget).toHaveBeenCalledWith({
    pane: 'agentHub',
    repoId: null
  })
})

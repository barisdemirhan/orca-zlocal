/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { createGlobalSettingsFixture } from '../../../../shared/global-settings-test-fixture'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { KeybindingActionId, KeybindingOverrides } from '../../../../shared/keybindings/types'
import { TooltipProvider } from '../ui/tooltip'
import { AgentHubSettingsPane } from './AgentHubSettingsPane'
import { AgentHubShortcutsDialog } from './AgentHubShortcutsDialog'
import { setAgentHubShortcutsOpen } from './agent-hub-shortcuts-dialog'
import { callStructuredAgentSession } from '@/runtime/native-chat/requests/structured-agent-session-call'
import { ensureLocalRuntimeCapabilities } from '@/runtime/hosts/capabilities/local-runtime-capabilities'
import { resetHostStructuredAgentsForTests } from '@/runtime/native-chat/agent-catalogs/host-structured-agents'
import { resetHostModelCatalogSnapshotsForTests } from '@/runtime/native-chat/model-catalogs/host-model-catalog-snapshots'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'

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
vi.mock('@/store/plugins/catalog/plugin-contribution-catalog', () => ({
  useEditablePluginCommands: () => []
}))
vi.mock('../settings/shortcuts/use-mac-captured-digit-chords', () => ({
  useMacCapturedDigitChords: () => []
}))
vi.mock('@/runtime/rpc/calls/runtime-rpc-call', () => ({
  callRuntimeRpc: vi.fn(async () => ({ agents: [{ agent: 'custom-acp', capabilities: {} }] }))
}))
vi.mock('@/runtime/native-chat/requests/structured-agent-session-call', () => ({
  callStructuredAgentSession: vi.fn(async () => ({ origin: 'unknown' }))
}))
vi.mock('@/runtime/hosts/capabilities/local-runtime-capabilities', async () => {
  const { AGENT_SESSION_MODEL_CATALOG_SAVED_ONLY_RUNTIME_CAPABILITY } =
    await import('../../../../shared/agent-session/structured-agent-session-surface-capabilities')
  const { STRUCTURED_AGENT_SESSION_REGISTERED_AGENTS_RUNTIME_CAPABILITY } =
    await import('../../../../shared/agent-session/structured-agent-session-surface-capabilities')
  return {
    ensureLocalRuntimeCapabilities: vi.fn(async () => [
      AGENT_SESSION_MODEL_CATALOG_SAVED_ONLY_RUNTIME_CAPABILITY,
      STRUCTURED_AGENT_SESSION_REGISTERED_AGENTS_RUNTIME_CAPABILITY
    ])
  }
})
const openPath = vi.fn()

beforeEach(() => {
  resetHostStructuredAgentsForTests()
  resetHostModelCatalogSnapshotsForTests()
  useAppStore.setState({
    settings: createGlobalSettingsFixture({ experimentalAgentHub: true }),
    keybindings: {}
  })
  vi.clearAllMocks()
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      app: {
        getAgentHubOrbDirectory: () => Promise.resolve('/tmp/orb'),
        readAgentHubOrbIdentity: () =>
          Promise.resolve({ soul: '', user: '', memory: [], truncated: false })
      },
      shell: { openPath },
      ui: { setShortcutRecorderFocused: vi.fn() }
    }
  })
})
afterEach(() => {
  cleanup()
  setAgentHubShortcutsOpen(false)
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
      <AgentHubShortcutsDialog />
    </TooltipProvider>
  )
}

it('keeps approvals and their warning independent of Orb placement', () => {
  useAppStore.setState({
    settings: createGlobalSettingsFixture({
      experimentalAgentHub: true,
      agentHubOrbPlacement: 'dock',
      agentHubOrbPermission: 'ask'
    })
  })
  render(<Pane />)
  const warning = 'The Orb runs commands without asking. Use with care.'
  expect(screen.queryByText(warning)).toBeNull()
  fireEvent.click(
    within(screen.getByRole('radiogroup', { name: 'Placement' })).getByRole('radio', {
      name: 'Floating'
    })
  )
  expect(useAppStore.getState().updateSettings).toHaveBeenLastCalledWith({
    agentHubOrbPlacement: 'floating'
  })
  expect(useAppStore.getState().settings?.agentHubOrbPlacement).toBe('floating')
  expect(useAppStore.getState().settings?.agentHubOrbPermission).toBe('ask')
  fireEvent.click(screen.getByRole('radio', { name: 'Full access' }))
  expect(useAppStore.getState().settings?.agentHubOrbPermission).toBe('free')
  expect(screen.getByText(warning)).toBeTruthy()
  fireEvent.click(screen.getByRole('radio', { name: 'Ask for approval' }))
  expect(useAppStore.getState().settings?.agentHubOrbPermission).toBe('ask')
  expect(screen.queryByText(warning)).toBeNull()
})

it('saves the normal and modifier-click Orb actions independently', () => {
  useAppStore.setState({ settings: createGlobalSettingsFixture({ agentHubOrbAgent: 'codex' }) })
  render(<Pane />)
  const normal = screen.getByRole('radiogroup', { name: 'Open Orb with' })
  const alternate = screen.getByRole('radiogroup', { name: /-click action$/ })
  expect(within(normal).getByRole('radio', { name: 'Live', checked: true })).toBeTruthy()
  expect(within(alternate).getByRole('radio', { name: 'Text', checked: true })).toBeTruthy()
  fireEvent.click(within(normal).getByRole('radio', { name: 'Dictate' }))
  fireEvent.click(within(alternate).getByRole('radio', { name: 'Live' }))
  expect(useAppStore.getState().settings?.agentHubOrbDefaultAction).toBe('dictate')
  expect(useAppStore.getState().settings?.agentHubOrbAlternateAction).toBe('live')
})

it('offers the modes Codex supports and selects Approve for me before any choice', () => {
  useAppStore.setState({
    settings: createGlobalSettingsFixture({
      experimentalAgentHub: true,
      agentHubOrbAgent: 'codex'
    })
  })
  render(<Pane />)
  const group = within(screen.getByRole('radiogroup', { name: 'Approvals' }))
  expect(
    group
      .getAllByRole('radio')
      .map((radio) => radio.getAttribute('aria-label') ?? radio.textContent)
  ).toEqual(['Ask for approval', 'Approve for me', 'Full access'])
  expect(group.getByRole('radio', { name: 'Approve for me' }).getAttribute('aria-checked')).toBe(
    'true'
  )
  fireEvent.click(group.getByRole('radio', { name: 'Approve for me' }))
  expect(useAppStore.getState().settings?.agentHubOrbPermission).toBe('auto')
})

it('keeps Pi Ask unavailable and Full access selected', () => {
  useAppStore.setState({
    settings: createGlobalSettingsFixture({
      experimentalAgentHub: true,
      agentHubOrbAgent: 'pi',
      agentHubOrbPermission: 'ask'
    })
  })
  render(<Pane />)
  const ask = screen.getByRole('radio', { name: 'Ask for approval' })
  expect(ask.getAttribute('aria-disabled')).toBe('true')
  expect(
    screen.getByText(
      'Pi requires Full access. Choose another agent to ask before running commands.'
    )
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('radio', { name: 'Full access' }))
  expect(useAppStore.getState().settings?.agentHubOrbPermission).toBe('free')
  fireEvent.click(ask)
  expect(useAppStore.getState().settings?.agentHubOrbPermission).toBe('free')
})

it('opens the Orb folder on the local host', async () => {
  render(<Pane />)
  expect(await screen.findByText('/tmp/orb')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Open folder' }))
  expect(openPath).toHaveBeenCalledWith('/tmp/orb', 'local')
})

it('loads registered ACP agents and clears the model pick when changing agents', async () => {
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

it('edits Orb and Hub shortcuts in the modal through the shared recorder and releases it on close', async () => {
  render(<Pane />)
  fireEvent.click(screen.getByRole('button', { name: 'Edit shortcuts' }))
  await screen.findByRole('dialog')
  fireEvent.click(screen.getByRole('button', { name: 'Add shortcut for Toggle Agent Hub' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add shortcut for Toggle Agent Hub Orb' }))
  expect(
    screen.queryByRole('button', { name: /Press shortcut keys for Toggle Agent Hub\./ })
  ).toBeNull()
  expect(window.api.ui.setShortcutRecorderFocused).toHaveBeenLastCalledWith(true)
  fireEvent.keyDown(
    screen.getByRole('button', { name: /Press shortcut keys for Toggle Agent Hub Orb/ }),
    {
      key: 'F8',
      code: 'F8',
      ctrlKey: true
    }
  )
  await waitFor(() =>
    expect(useAppStore.getState().keybindings['agentHub.toggleOrb']).toEqual([
      'Alt+Shift+Space',
      'Mod+F8'
    ])
  )
  expect(window.api.ui.setShortcutRecorderFocused).toHaveBeenLastCalledWith(false)
  fireEvent.click(screen.getByRole('button', { name: 'Add shortcut for Toggle Agent Hub' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
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

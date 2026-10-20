import { describe, expect, it } from 'vitest'
import { getKeybindingDefinition, keybindingMatchesAction } from '../../../../shared/keybindings'
import { groupDefinitions, type ShortcutGroup } from './shortcut-groups'
import { buildShortcutRowVisibility } from './shortcut-row-visibility'

function globalGroup(): ShortcutGroup {
  const items = (
    [
      'workspace.openBoard',
      'dashboard.toggle',
      'agentHub.toggleOrb',
      'agentHub.toggle',
      'agentHub.nextWaiting',
      'agentHub.dockMirrors',
      'agentHub.toggleCanvas',
      'agentHub.arrangeMirrors',
      'agentHub.focusMirror',
      'agentHub.popOut',
      'agentHub.jumpToMirror',
      'agentHub.nextMirrorTab',
      'agentHub.previousMirrorTab'
    ] as const
  ).map((actionId) => {
    const definition = getKeybindingDefinition(actionId)
    if (!definition) {
      throw new Error(`Missing keybinding definition: ${actionId}`)
    }
    return definition
  })
  return { title: 'Global', items }
}

const baseOptions = {
  keybindings: {},
  conflictByAction: new Map(),
  terminalShortcutPolicy: 'orca-first',
  platform: 'darwin',
  managedBrowserCreationEnabled: false,
  mobileEmulatorCreationEnabled: false,
  agentDashboardEnabled: false,
  agentHubEnabled: false,
  agentHubCanvasEnabled: true,
  settingsSearchQuery: '',
  shortcutQuery: '',
  shortcutFilter: 'all'
} as const

describe('buildShortcutRowVisibility', () => {
  it('shows a suppressed implicit toggle as unassigned without a modified/reset obligation', () => {
    const item = getKeybindingDefinition('terminal.toggleNativeChat')
    if (!item) {
      throw new Error('Missing toggle definition')
    }
    const result = buildShortcutRowVisibility({
      ...baseOptions,
      groups: [{ title: 'Chat', items: [item] }],
      keybindings: { 'worktree.navigateDown': ['Mod+Shift+J'] }
    })
    expect(result.shortcutRows[0]).toMatchObject({ effective: [], modified: false })
    expect(result.filterCounts.modified).toBe(0)
    expect(result.filterCounts.unassigned).toBe(1)
  })

  it('hides the canvas shortcut when canvas is disabled without hiding other hub commands', () => {
    const result = buildShortcutRowVisibility({
      ...baseOptions,
      groups: [globalGroup()],
      agentHubEnabled: true,
      agentHubCanvasEnabled: false
    })
    expect(result.shortcutRows.some((row) => row.item.id === 'agentHub.toggleCanvas')).toBe(false)
    expect(result.shortcutRows.some((row) => row.item.id === 'agentHub.toggle')).toBe(true)
  })
  it('hides the agent hub shortcuts while its experiment is off', () => {
    const hidden = buildShortcutRowVisibility({ ...baseOptions, groups: [globalGroup()] })
    expect(hidden.shortcutRows.map((row) => row.item.id)).toEqual(['workspace.openBoard'])

    const shown = buildShortcutRowVisibility({
      ...baseOptions,
      groups: [globalGroup()],
      agentHubEnabled: true
    })
    expect(shown.shortcutRows.map((row) => row.item.id)).toEqual([
      'workspace.openBoard',
      'agentHub.toggleOrb',
      'agentHub.toggle',
      'agentHub.nextWaiting',
      'agentHub.dockMirrors',
      'agentHub.toggleCanvas',
      'agentHub.arrangeMirrors',
      'agentHub.focusMirror',
      'agentHub.popOut',
      'agentHub.jumpToMirror',
      'agentHub.nextMirrorTab',
      'agentHub.previousMirrorTab'
    ])
  })
})

it('lists the Orb quick-access shortcut under Agent Hub and lets assigned mirror tabs run in terminals', () => {
  const groups = groupDefinitions([])
  const result = buildShortcutRowVisibility({ ...baseOptions, groups, agentHubEnabled: true })
  const orb = result.shortcutRows.find((row) => row.item.id === 'agentHub.toggleOrb')
  expect(orb?.groupTitle).toBe('Agent Hub')
  expect(orb?.effective).toEqual(['Alt+Shift+Space'])
  for (const id of [
    'agentHub.toggleOrb',
    'agentHub.nextMirrorTab',
    'agentHub.previousMirrorTab'
  ] as const) {
    expect(
      keybindingMatchesAction(
        id,
        { key: 'F8', code: 'F8', meta: true },
        'darwin',
        { [id]: ['Mod+F8'] },
        { context: 'terminal', terminalShortcutPolicy: 'terminal-first' }
      )
    ).toBe(true)
  }
})

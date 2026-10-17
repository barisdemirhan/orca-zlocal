import type { KeybindingDefinition } from './types'
import { platformBindings } from './definitions-support'

export const KEYBINDING_DEFINITION_CORE_4: readonly KeybindingDefinition[] = [
  {
    id: 'chat.find',
    title: 'Find in chat',
    group: 'Chat',
    scope: 'chat',
    searchKeywords: ['shortcut', 'chat', 'find', 'search'],
    defaultBindings: platformBindings(['Mod+F'])
  },
  {
    id: 'terminal.toggleNativeChat',
    title: 'Switch between Chat UI and terminal',
    group: 'Chat',
    scope: 'terminal',
    conflictGroups: ['global', 'tabs', 'terminal', 'chat', 'fileExplorer'],
    implicitDefaultYields: true,
    searchKeywords: ['shortcut', 'chat', 'chat ui', 'native chat', 'terminal', 'toggle', 'switch'],
    defaultBindings: platformBindings(['Mod+Shift+J'])
  },
  {
    id: 'sidebar.childWorkspaces.toggle',
    title: 'Toggle Child Workspaces',
    group: 'Global',
    scope: 'global',
    searchKeywords: [
      'shortcut',
      'sidebar',
      'child',
      'children',
      'nested',
      'lineage',
      'workspaces',
      'worktree',
      'collapse',
      'expand',
      'show',
      'hide'
    ],
    // Why: ship unbound like the sleeping toggle, so no existing chord is claimed on any platform.
    defaultBindings: platformBindings([])
  },
  {
    id: 'agentHub.toggleOrb',
    title: 'Toggle Agent Hub Orb',
    group: 'Agent Hub',
    scope: 'global',
    searchKeywords: ['shortcut', 'agent', 'hub', 'orb', 'voice', 'talk'],
    defaultBindings: platformBindings([]),
    allowInTerminal: true
  },
  {
    id: 'agentHub.toggle',
    title: 'Toggle Agent Hub',
    group: 'Agent Hub',
    scope: 'global',
    searchKeywords: ['shortcut', 'agent', 'agents', 'hub', 'inbox', 'status bar', 'toggle'],
    // Unbound until opted in: experiments must not claim users' existing chords.
    defaultBindings: platformBindings([]),
    allowInTerminal: true
  },
  {
    id: 'agentHub.nextWaiting',
    title: 'Jump to Next Agent Waiting for You',
    group: 'Agent Hub',
    scope: 'global',
    searchKeywords: ['shortcut', 'agent', 'agents', 'hub', 'waiting', 'next', 'jump', 'question'],
    defaultBindings: platformBindings([]),
    allowInTerminal: true
  },
  {
    id: 'agentHub.openAnswerQueue',
    title: 'Open the Agent Hub Answer Queue',
    group: 'Agent Hub',
    scope: 'global',
    searchKeywords: ['shortcut', 'agent', 'hub', 'answer', 'queue', 'question', 'waiting'],
    defaultBindings: platformBindings([]),
    allowInTerminal: true
  },
  {
    id: 'agentHub.dockMirrors',
    title: 'Send Agent Hub Mirrors to the Hub or Bring Them Back',
    group: 'Agent Hub',
    scope: 'global',
    searchKeywords: ['shortcut', 'agent', 'hub', 'mirror', 'minimize', 'restore', 'floating'],
    defaultBindings: platformBindings([]),
    allowInTerminal: true
  },
  {
    id: 'agentHub.toggleCanvas',
    title: 'Open or Leave the Agent Hub Canvas',
    group: 'Agent Hub',
    scope: 'global',
    searchKeywords: ['shortcut', 'agent', 'hub', 'canvas', 'mirror', 'toggle'],
    defaultBindings: platformBindings([]),
    allowInTerminal: true
  },
  {
    id: 'agentHub.arrangeMirrors',
    title: 'Arrange Agent Hub Mirrors in the Default Layout',
    group: 'Agent Hub',
    scope: 'global',
    searchKeywords: ['shortcut', 'agent', 'hub', 'mirror', 'arrange', 'layout', 'grid', 'tile'],
    defaultBindings: platformBindings([]),
    allowInTerminal: true
  },
  {
    id: 'agentHub.focusMirror',
    title: 'Focus or Unfocus the Active Agent Hub Canvas Mirror',
    group: 'Agent Hub',
    scope: 'global',
    searchKeywords: ['shortcut', 'agent', 'hub', 'mirror'],
    defaultBindings: platformBindings([]),
    allowInTerminal: true
  },
  {
    id: 'agentHub.popOut',
    title: 'Pop Out the Active Agent Hub Terminal',
    group: 'Agent Hub',
    scope: 'global',
    searchKeywords: ['shortcut', 'agent', 'hub', 'mirror'],
    defaultBindings: platformBindings([]),
    allowInTerminal: true
  },
  {
    id: 'agentHub.jumpToMirror',
    title: 'Jump to the Active Agent Hub Mirror in Its Workspace',
    group: 'Agent Hub',
    scope: 'global',
    searchKeywords: ['shortcut', 'agent', 'hub', 'mirror'],
    defaultBindings: platformBindings([]),
    allowInTerminal: true
  },
  {
    id: 'agentHub.nextMirrorTab',
    title: 'Next Agent Hub Mirror Tab',
    group: 'Agent Hub',
    scope: 'global',
    searchKeywords: ['shortcut', 'agent', 'hub', 'mirror', 'tab', 'next'],
    defaultBindings: platformBindings([]),
    allowInTerminal: true
  },
  {
    id: 'agentHub.previousMirrorTab',
    title: 'Previous Agent Hub Mirror Tab',
    group: 'Agent Hub',
    scope: 'global',
    searchKeywords: ['shortcut', 'agent', 'hub', 'mirror', 'tab', 'previous'],
    defaultBindings: platformBindings([]),
    allowInTerminal: true
  },
  {
    id: 'terminal.clearPaneTitle',
    title: 'Clear Pane Title',
    group: 'Terminal Panes',
    scope: 'terminal',
    searchKeywords: ['shortcut', 'terminal', 'pane', 'clear title', 'remove title', 'title'],
    defaultBindings: platformBindings([])
  },
  {
    id: 'terminal.closePane',
    title: 'Close active pane',
    group: 'Terminal Panes',
    scope: 'terminal',
    searchKeywords: ['shortcut', 'pane', 'close'],
    defaultBindings: platformBindings(['Mod+W'])
  },
  {
    id: 'terminal.splitRight',
    title: 'Split terminal right',
    group: 'Terminal Panes',
    scope: 'terminal',
    searchKeywords: ['shortcut', 'pane', 'split', 'right'],
    defaultBindings: {
      darwin: ['Mod+D'],
      linux: ['Mod+Shift+D'],
      win32: ['Mod+Shift+D']
    }
  },
  {
    id: 'terminal.splitDown',
    title: 'Split terminal down',
    group: 'Terminal Panes',
    scope: 'terminal',
    searchKeywords: ['shortcut', 'pane', 'split', 'down'],
    defaultBindings: {
      darwin: ['Mod+Shift+D'],
      linux: ['Alt+Shift+D'],
      win32: ['Alt+Shift+D']
    }
  },
  {
    id: 'terminal.switchInputSource',
    title: 'Switch input source / language (native)',
    group: 'Terminal Panes',
    scope: 'terminal',
    searchKeywords: [
      'shortcut',
      'input',
      'source',
      'language',
      'korean',
      'english',
      'ime',
      'switch',
      'hangul',
      'layout'
    ],
    defaultBindings: {
      darwin: [],
      linux: [],
      win32: []
    },
    // Why: macOS uses Shift+Space as an input-source shortcut; Orca otherwise rejects Shift-only bindings to avoid stealing typed text.
    allowShiftOnlyKeybindings: true
  }
]

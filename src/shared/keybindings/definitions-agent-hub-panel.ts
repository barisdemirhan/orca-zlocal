import type { KeybindingDefinition } from './types'
import { platformBindings } from './definitions-support'

export const KEYBINDING_DEFINITION_AGENT_HUB_PANEL: readonly KeybindingDefinition[] = [
  {
    id: 'agentHub.toggleOrb',
    title: 'Toggle Agent Hub Orb',
    group: 'Agent Hub',
    scope: 'global',
    searchKeywords: ['shortcut', 'agent', 'hub', 'orb', 'voice', 'talk'],
    defaultBindings: platformBindings(['Alt+Shift+Space']),
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
  }
]

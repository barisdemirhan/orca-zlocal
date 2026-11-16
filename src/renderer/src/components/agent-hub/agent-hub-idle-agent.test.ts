import { acceptedAgentStatuses } from '@/store/slices/agent-status/accepted-agent-statuses'
import { describe, expect, it } from 'vitest'
import {
  LEAF_ID,
  makeRepo,
  makeTabWithIds,
  makeWorktreeWithId,
  PANE_KEY
} from '../activity/ActivityPrototypePage-test-fixtures'
import { resolveAgentHubIdleAgent, type AgentHubIdleAgentSignals } from './agent-hub-idle-agent'

const none: AgentHubIdleAgentSignals = {
  terminalLayoutsByTabId: {},
  runtimePaneTitlesByTabId: {},
  agentStatusByPaneKey: acceptedAgentStatuses(),
  sleepingAgentSessionsByPaneKey: {},
  paneForegroundAgentByPaneKey: {},
  ptyIdsByTabId: {},
  repos: [],
  worktreesByRepo: {},
  folderWorkspaces: [],
  projectGroups: []
}

describe('resolveAgentHubIdleAgent', () => {
  it('reads a hand-started Claude from its idle title mark', () => {
    const tab = makeTabWithIds('tab-1', 'wt-1', '✳ kolayoto-feedback-analysis-pr')
    expect(resolveAgentHubIdleAgent(tab, none)).toBe('claude')
  })

  it('names the agent Orca launched in the tab, whatever its title says', () => {
    const tab = {
      ...makeTabWithIds('tab-1', 'wt-1', 'Design review'),
      launchAgent: 'codex' as const
    }
    expect(resolveAgentHubIdleAgent(tab, none)).toBe('codex')
  })

  it('leaves a plain shell a shell', () => {
    expect(
      resolveAgentHubIdleAgent(makeTabWithIds('tab-1', 'wt-1', '~/Developer'), none)
    ).toBeNull()
    expect(resolveAgentHubIdleAgent(makeTabWithIds('tab-2', 'wt-1', 'yarn start'), none)).toBeNull()
  })
})

describe('resolveAgentHubIdleAgent after the launched agent exits', () => {
  // Ctrl+C out of Codex: no hook row ever existed, the shell prompt is back in front (OSC 133;D).
  const tab = {
    ...makeTabWithIds('tab-1', 'wt-1', '../personal-hub'),
    launchAgent: 'codex' as const
  }
  const signals = (
    connectionId: string | null,
    shellForeground: boolean
  ): AgentHubIdleAgentSignals => {
    const repo = { ...makeRepo(), connectionId }
    return {
      ...none,
      repos: [repo],
      worktreesByRepo: { [repo.id]: [makeWorktreeWithId('wt-1', repo.id)] },
      terminalLayoutsByTabId: {
        'tab-1': { root: null, activeLeafId: LEAF_ID, expandedLeafId: null }
      },
      paneForegroundAgentByPaneKey: { [PANE_KEY]: { agent: null, shellForeground } }
    }
  }

  it('drops a local agent once the shell is back in the foreground', () => {
    expect(resolveAgentHubIdleAgent(tab, signals(null, true))).toBeNull()
  })

  it('keeps a local agent while it still holds the foreground', () => {
    expect(resolveAgentHubIdleAgent(tab, signals(null, false))).toBe('codex')
  })

  it('keeps a remote agent, which has no shell-foreground producer', () => {
    expect(resolveAgentHubIdleAgent(tab, signals('ssh-workhost', true))).toBe('codex')
  })
})

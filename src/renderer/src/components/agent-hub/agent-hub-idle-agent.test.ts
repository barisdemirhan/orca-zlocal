import { describe, expect, it } from 'vitest'
import { makeTabWithIds } from '../activity/ActivityPrototypePage-test-fixtures'
import { resolveAgentHubIdleAgent, type AgentHubIdleAgentSignals } from './agent-hub-idle-agent'

const none: AgentHubIdleAgentSignals = {
  terminalLayoutsByTabId: {},
  runtimePaneTitlesByTabId: {},
  agentStatusByPaneKey: {},
  retainedAgentsByPaneKey: {},
  sleepingAgentSessionsByPaneKey: {},
  paneForegroundAgentByPaneKey: {}
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

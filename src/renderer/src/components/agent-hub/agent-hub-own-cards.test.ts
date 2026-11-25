import { describe, expect, it } from 'vitest'
import { makeTabWithIds, makeWorktree } from './agent-hub-activity-test-fixtures'
import { createAgentHubMirrorWindow } from './agent-hub-mirror-membership'
import { chooseAgentHubOwnCard, agentHubOwnCards } from './agent-hub-own-cards'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

function target(tabId: string): AgentHubPaneTarget {
  const worktree = makeWorktree()
  return {
    worktree,
    repo: null,
    tab: makeTabWithIds(tabId, worktree.id),
    paneKey: `${tabId}:leaf`,
    title: tabId,
    agentType: 'claude'
  }
}

describe('agent own cards', () => {
  const mine = createAgentHubMirrorWindow(target('tab-mine'))
  const other = createAgentHubMirrorWindow(target('tab-other'))
  const parked = createAgentHubMirrorWindow(target('tab-mine'))
  const mirrors = { windows: [mine, other], chips: [{ window: parked, minimizedAt: 1 }] }

  it('lists only cards that show the caller, never another agent card', () => {
    const ids = agentHubOwnCards(mirrors, target('tab-mine')).map((card) => card.window.id)
    expect(ids).toEqual([mine.id, parked.id])
    expect(agentHubOwnCards(mirrors, target('tab-stranger'))).toEqual([])
  })

  it('refuses another agent card by id without acting on it', () => {
    const choice = chooseAgentHubOwnCard(mirrors, target('tab-mine'), other.id)
    expect(choice).toMatchObject({ refusal: { code: 'not_your_card' } })
    expect(chooseAgentHubOwnCard(mirrors, target('tab-mine'), 'missing')).toMatchObject({
      refusal: { code: 'no_card' }
    })
    expect(chooseAgentHubOwnCard(mirrors, null)).toMatchObject({ refusal: { code: 'no_card' } })
  })

  it('prefers the visible card when none is named', () => {
    expect(chooseAgentHubOwnCard(mirrors, target('tab-mine'))).toMatchObject({
      card: { window: { id: mine.id }, parked: false }
    })
  })
})

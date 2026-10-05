import { beforeEach, describe, expect, it } from 'vitest'
import {
  makeRepo,
  makeTabWithIds,
  makeWorktree
} from '../activity/ActivityPrototypePage-test-fixtures'
import {
  agentHubRowOfTab,
  isAgentHubTabAutoPopout,
  resetAgentHubTabAutoPopoutForTest,
  toggleAgentHubTabAutoPopout
} from './agent-hub-tab-auto-popout'
import { buildAgentHubTerminalTree } from './agent-hub-terminal-tree'

describe('agent hub tab auto pop-out', () => {
  beforeEach(() => {
    resetAgentHubTabAutoPopoutForTest()
  })

  it('is off until toggled, one tab at a time', () => {
    expect(isAgentHubTabAutoPopout('tab-1')).toBe(false)
    toggleAgentHubTabAutoPopout('tab-1')
    expect(isAgentHubTabAutoPopout('tab-1')).toBe(true)
    expect(isAgentHubTabAutoPopout('tab-2')).toBe(false)
    toggleAgentHubTabAutoPopout('tab-1')
    expect(isAgentHubTabAutoPopout('tab-1')).toBe(false)
  })

  it("finds a tab's row in the hub's tree, and none for a closed tab", () => {
    const repo = makeRepo()
    const worktree = makeWorktree()
    const tree = buildAgentHubTerminalTree({
      projectGroups: [],
      repos: [repo],
      worktreesByRepo: { [repo.id]: [worktree] },
      folderWorkspaces: [],
      tabsByWorktree: {
        [worktree.id]: ['tab-1', 'tab-2'].map((id) => makeTabWithIds(id, worktree.id))
      },
      threads: [],
      floating: null,
      includeShells: true,
      ungroupedLabel: 'Ungrouped',
      unknownProjectLabel: 'Unknown'
    })

    expect(agentHubRowOfTab(tree, 'tab-2')).toMatchObject({ key: 'tab-2', paneKey: null })
    expect(agentHubRowOfTab(tree, 'tab-gone')).toBeNull()
  })
})

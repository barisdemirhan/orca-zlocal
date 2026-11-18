import { describe, expect, it } from 'vitest'
import {
  makeRepo,
  makeWorktreeWithId,
  LEAF_ID,
  LEAF_ID_2,
  PANE_KEY
} from './agent-hub-activity-test-fixtures'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import {
  agentHubLocation,
  agentHubLocationLabel,
  resolveAgentHubPtyId
} from './agent-hub-pane-target'

describe('resolveAgentHubPtyId', () => {
  const layout = {
    root: null,
    activeLeafId: LEAF_ID_2,
    expandedLeafId: null,
    ptyIdsByLeafId: { [LEAF_ID]: 'pty-agent', [LEAF_ID_2]: 'pty-shell' }
  }

  it("resolves an agent pane's own PTY and a shell tab's active pane", () => {
    const state = {
      terminalLayoutsByTabId: { 'tab-1': layout },
      ptyIdsByTabId: { 'tab-1': ['pty-agent', 'pty-shell'] }
    }
    expect(resolveAgentHubPtyId(state, 'tab-1', PANE_KEY)).toBe('pty-agent')
    expect(resolveAgentHubPtyId(state, 'tab-1', null)).toBe('pty-shell')
  })

  it('reports no PTY when the layout points at one that is no longer live', () => {
    const state = {
      terminalLayoutsByTabId: { 'tab-1': layout },
      ptyIdsByTabId: { 'tab-1': ['pty-other'] }
    }
    expect(resolveAgentHubPtyId(state, 'tab-1', PANE_KEY)).toBeNull()
  })

  it('falls back to the only live PTY of a shell tab without a layout', () => {
    const state = { terminalLayoutsByTabId: {}, ptyIdsByTabId: { 'tab-1': ['pty-only'] } }
    expect(resolveAgentHubPtyId(state, 'tab-1', null)).toBe('pty-only')
  })
})

describe('agentHubLocationLabel', () => {
  it('names the group, project and workspace', () => {
    const repo = { ...makeRepo(), displayName: 'acme', projectGroupId: 'group-1' }
    const worktree = makeWorktreeWithId('wt-1', repo.id, 'checkout-flow')
    expect(agentHubLocationLabel({ worktree, repo }, new Map([['group-1', 'Freelance']]))).toBe(
      'Freelance › acme · checkout-flow'
    )
  })

  it('uses the workspace name alone for floating and folder panes', () => {
    const worktree = makeWorktreeWithId('global-floating-terminal', 'floating', 'Floating terminal')
    expect(agentHubLocationLabel({ worktree, repo: null }, new Map())).toBe('Floating terminal')
  })
})

describe('agentHubLocation host', () => {
  const repo = { ...makeRepo(), displayName: 'acme' }
  const worktree = makeWorktreeWithId('wt-1', repo.id, 'main')

  it('names the machine only when the workspaces span more than one host', () => {
    const labels = new Map([[getWorktreeHostIdentity(worktree), 'Local Mac']])
    expect(agentHubLocation({ worktree, repo }, new Map(), labels).host).toBe('Local Mac')
    expect(agentHubLocation({ worktree, repo }, new Map(), undefined).host).toBeNull()
  })
})

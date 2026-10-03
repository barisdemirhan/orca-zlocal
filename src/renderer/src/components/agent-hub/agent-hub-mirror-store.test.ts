import { beforeEach, describe, expect, it } from 'vitest'
import { makeTabWithIds, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
import {
  closeAgentHubMirror,
  minimizeAgentHubMirror,
  openAgentHubMirror,
  readAgentHubMirrors,
  rememberAgentHubMirrorOrigin,
  resetAgentHubMirrorsForTest,
  restoreAgentHubMirror
} from './agent-hub-mirror-store'
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

const chipKeys = (): string[] =>
  readAgentHubMirrors().chips.map((chip) => chip.target.paneKey ?? '')

describe('agent hub mirror store', () => {
  beforeEach(() => {
    resetAgentHubMirrorsForTest()
    rememberAgentHubMirrorOrigin({ x: 100, y: 200 })
  })

  it('minimizes the open window into a chip where it stood', () => {
    openAgentHubMirror(target('tab-a'))
    minimizeAgentHubMirror()

    expect(readAgentHubMirrors().open).toBeNull()
    expect(readAgentHubMirrors().chips).toMatchObject([{ x: 100, y: 200 }])
  })

  it('stacks a second chip below one already at that spot', () => {
    openAgentHubMirror(target('tab-a'))
    minimizeAgentHubMirror()
    openAgentHubMirror(target('tab-b'))
    minimizeAgentHubMirror()

    expect(readAgentHubMirrors().chips.map((chip) => chip.y)).toEqual([200, 240])
  })

  it('replaces a peeked window but keeps a restored one as a chip', () => {
    openAgentHubMirror(target('tab-a'))
    openAgentHubMirror(target('tab-b'))
    expect(chipKeys()).toEqual([])

    minimizeAgentHubMirror()
    restoreAgentHubMirror('tab-b:leaf')
    openAgentHubMirror(target('tab-c'))
    expect(readAgentHubMirrors().open?.paneKey).toBe('tab-c:leaf')
    expect(chipKeys()).toEqual(['tab-b:leaf'])
  })

  it('swaps a kept window into the spot of the chip being restored', () => {
    openAgentHubMirror(target('tab-a'))
    minimizeAgentHubMirror()
    openAgentHubMirror(target('tab-b'))
    minimizeAgentHubMirror()
    restoreAgentHubMirror('tab-a:leaf')
    restoreAgentHubMirror('tab-b:leaf')

    expect(readAgentHubMirrors().open?.paneKey).toBe('tab-b:leaf')
    expect(readAgentHubMirrors().chips).toMatchObject([
      { target: { paneKey: 'tab-a:leaf' }, x: 100, y: 240 }
    ])
  })

  it('opening a minimized pane from the hub restores its chip instead of duplicating it', () => {
    openAgentHubMirror(target('tab-a'))
    minimizeAgentHubMirror()
    openAgentHubMirror(target('tab-a'))

    expect(chipKeys()).toEqual([])
    expect(readAgentHubMirrors().openKept).toBe(true)
    closeAgentHubMirror()
    expect(readAgentHubMirrors().open).toBeNull()
  })
})

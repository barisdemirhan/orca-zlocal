import { beforeEach, describe, expect, it } from 'vitest'
import { makeTabWithIds, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
import {
  closeAgentHubMirror,
  focusAgentHubMirror,
  MAX_AGENT_HUB_MIRROR_WINDOWS,
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

const windowKeys = (): string[] => readAgentHubMirrors().windows.map((open) => open.paneKey ?? '')
const chipKeys = (): string[] =>
  readAgentHubMirrors().chips.map((chip) => chip.target.paneKey ?? '')

describe('agent hub mirror store', () => {
  beforeEach(() => {
    resetAgentHubMirrorsForTest()
  })

  it('keeps several mirrors open and brings a reopened one to the front', () => {
    openAgentHubMirror(target('tab-a'))
    openAgentHubMirror(target('tab-b'))
    openAgentHubMirror(target('tab-a'))

    expect(windowKeys()).toEqual(['tab-b:leaf', 'tab-a:leaf'])
    focusAgentHubMirror('tab-b:leaf')
    expect(windowKeys()).toEqual(['tab-a:leaf', 'tab-b:leaf'])
  })

  it('shrinks the back-most window into a chip past the cap', () => {
    const tabs = Array.from({ length: MAX_AGENT_HUB_MIRROR_WINDOWS + 1 }, (_, i) => `tab-${i}`)
    for (const tabId of tabs) {
      openAgentHubMirror(target(tabId))
    }

    expect(readAgentHubMirrors().windows).toHaveLength(MAX_AGENT_HUB_MIRROR_WINDOWS)
    expect(chipKeys()).toEqual(['tab-0:leaf'])
  })

  it('minimizes a window into a chip where it stood, stacking chips at the same spot', () => {
    rememberAgentHubMirrorOrigin('tab-a:leaf', { x: 100, y: 200 })
    rememberAgentHubMirrorOrigin('tab-b:leaf', { x: 100, y: 200 })
    openAgentHubMirror(target('tab-a'))
    openAgentHubMirror(target('tab-b'))
    minimizeAgentHubMirror('tab-a:leaf')
    minimizeAgentHubMirror('tab-b:leaf')

    expect(windowKeys()).toEqual([])
    expect(readAgentHubMirrors().chips.map((chip) => [chip.x, chip.y])).toEqual([
      [100, 200],
      [100, 240]
    ])
  })

  it('restores a chip as the front window and closes only the one asked', () => {
    openAgentHubMirror(target('tab-a'))
    openAgentHubMirror(target('tab-b'))
    minimizeAgentHubMirror('tab-a:leaf')
    restoreAgentHubMirror('tab-a:leaf')

    expect(chipKeys()).toEqual([])
    expect(windowKeys()).toEqual(['tab-b:leaf', 'tab-a:leaf'])
    closeAgentHubMirror('tab-b:leaf')
    expect(windowKeys()).toEqual(['tab-a:leaf'])
  })
})

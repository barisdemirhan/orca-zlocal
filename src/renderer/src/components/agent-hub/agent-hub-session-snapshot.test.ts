/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from 'vitest'
import {
  AGENT_HUB_SESSION_STORAGE_KEY,
  agentHubSessionSnapshot,
  clearAgentHubSessionSnapshot,
  parseAgentHubSessionSnapshot,
  readAgentHubSessionSnapshot,
  writeAgentHubSessionSnapshot,
  type AgentHubSavedMirror
} from './agent-hub-session-snapshot'

const mirror: AgentHubSavedMirror = {
  worktreeId: 'wt-1',
  tabId: 'tab-a',
  paneKey: 'tab-a:11111111-1111-4111-8111-111111111111',
  title: 'Fix the build',
  agentType: 'claude',
  minimized: false,
  minimizedAt: 0,
  geometry: { x: 40, y: 60, width: 640, height: 400 },
  keptPlace: true
}

const snapshot = agentHubSessionSnapshot({
  mirrors: [{ ...mirror, tabId: 'tab-b', paneKey: null, minimized: true, minimizedAt: 7 }, mirror],
  canvasOpen: true,
  canvasParked: ['tab-b'],
  autoPopoutTabIds: ['tab-a'],
  hiddenFamilyRoots: ['tab-a:11111111-1111-4111-8111-111111111111']
})

afterEach(() => {
  window.localStorage.clear()
})

describe('the agent hub session snapshot', () => {
  it('comes back from storage as it was written', () => {
    writeAgentHubSessionSnapshot(snapshot)

    expect(readAgentHubSessionSnapshot()).toEqual(snapshot)
  })

  it('reads as nothing when none was written, or after it is cleared', () => {
    expect(readAgentHubSessionSnapshot()).toBeNull()
    writeAgentHubSessionSnapshot(snapshot)
    clearAgentHubSessionSnapshot()

    expect(readAgentHubSessionSnapshot()).toBeNull()
  })

  it('ignores a record of another version or shape', () => {
    expect(parseAgentHubSessionSnapshot({ ...snapshot, version: 2 })).toBeNull()
    expect(parseAgentHubSessionSnapshot({ version: 1 })).toBeNull()
    expect(parseAgentHubSessionSnapshot([snapshot])).toBeNull()
    expect(parseAgentHubSessionSnapshot(null)).toBeNull()
    window.localStorage.setItem(AGENT_HUB_SESSION_STORAGE_KEY, '{not json')
    expect(readAgentHubSessionSnapshot()).toBeNull()
  })

  it('leaves out entries it cannot trust and keeps the rest', () => {
    const parsed = parseAgentHubSessionSnapshot({
      version: 1,
      mirrors: [
        mirror,
        { ...mirror, tabId: '' },
        { ...mirror, worktreeId: 5 },
        'tab-c',
        { ...mirror, tabId: 'tab-d', geometry: { x: 0, y: 0, width: Number.NaN, height: 10 } },
        { ...mirror, tabId: 'tab-e', geometry: { x: 0, y: 0, width: 0, height: 10 }, agentType: 9 }
      ],
      canvasOpen: 'yes',
      canvasParked: ['tab-a', 4, ''],
      autoPopoutTabIds: 'tab-a'
    })

    expect(parsed?.mirrors.map((saved) => saved.tabId)).toEqual(['tab-a', 'tab-d', 'tab-e'])
    expect(parsed?.mirrors[1]?.geometry).toBeNull()
    expect(parsed?.mirrors[2]).toMatchObject({ geometry: null, agentType: null })
    expect(parsed).toMatchObject({
      canvasOpen: false,
      canvasParked: ['tab-a'],
      autoPopoutTabIds: [],
      hiddenFamilyRoots: []
    })
  })
})

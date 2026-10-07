/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AGENT_HUB_SESSION_STORAGE_KEY,
  AGENT_HUB_LEGACY_SESSION_STORAGE_KEY,
  agentHubSessionSnapshot,
  clearAgentHubSessionSnapshot,
  parseAgentHubSessionSnapshot,
  readAgentHubSessionRecord,
  readAgentHubSessionSnapshot,
  writeAgentHubSessionSnapshot,
  type AgentHubSavedMirror
} from './agent-hub-session-snapshot'

const saved = (id: string, tabId = id): AgentHubSavedMirror => ({
  id,
  tabs: [
    {
      id: `entry-${id}`,
      worktreeId: 'wt-1',
      tabId,
      paneKey: null,
      hostIdentity: '|wt-1',
      title: tabId,
      agentType: 'claude',
      origin: 'manual'
    }
  ],
  activeTabId: `entry-${id}`,
  minimized: false,
  minimizedAt: 0,
  geometry: { x: 40, y: 60, width: 640, height: 400 },
  keptPlace: true
})
const snapshot = agentHubSessionSnapshot({
  windows: [saved('a'), { ...saved('b'), minimized: true, minimizedAt: 7 }],
  canvasOpen: true,
  canvasParked: ['b'],
  hiddenFamilyRoots: []
})
afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('session v2 and migration', () => {
  it('round-trips complete ordered windows with stable identities and selection', () => {
    const a = saved('a')
    const grouped = { ...a, tabs: [...a.tabs, ...saved('c').tabs], activeTabId: 'entry-c' }
    const session = { ...snapshot, windows: [grouped, snapshot.windows[1]!] }
    expect(writeAgentHubSessionSnapshot(session)).toBe(true)
    expect(readAgentHubSessionSnapshot()).toEqual(session)
    expect(readAgentHubSessionRecord().status).toBe('valid')
  })
  it('uses deterministic migration ids and maps geometry, chip order and canvas references', () => {
    const legacy = {
      version: 1,
      mirrors: [
        {
          worktreeId: 'wt-1',
          tabId: 'a',
          paneKey: null,
          title: 'A',
          minimized: true,
          minimizedAt: 7,
          geometry: saved('a').geometry,
          keptPlace: true
        },
        { worktreeId: 'wt-1', tabId: 'b', paneKey: null, title: 'B' }
      ],
      canvasOpen: false,
      canvasParked: ['a', 'gone']
    }
    window.localStorage.setItem(AGENT_HUB_LEGACY_SESSION_STORAGE_KEY, JSON.stringify(legacy))
    const first = readAgentHubSessionRecord()
    expect(first.status).toBe('migrated')
    expect(first.snapshot).toEqual(parseAgentHubSessionSnapshot(legacy))
    expect(first.snapshot?.windows.map((window) => window.tabs[0]?.tabId)).toEqual(['a', 'b'])
    expect(first.snapshot?.windows[0]).toMatchObject({
      minimizedAt: 7,
      geometry: saved('a').geometry,
      keptPlace: true,
      tabs: [{ origin: 'manual' }]
    })
    expect(first.snapshot?.canvasParked).toEqual([first.snapshot?.windows[0]?.id])
    expect(window.localStorage.getItem(AGENT_HUB_LEGACY_SESSION_STORAGE_KEY)).toBe(
      JSON.stringify(legacy)
    )
  })
  it('prefers v2 and never falls back to stale v1 when v2 is damaged or unsupported', () => {
    window.localStorage.setItem(
      AGENT_HUB_LEGACY_SESSION_STORAGE_KEY,
      JSON.stringify({ version: 1, mirrors: [{ worktreeId: 'wt-1', tabId: 'old' }] })
    )
    writeAgentHubSessionSnapshot(snapshot)
    expect(readAgentHubSessionSnapshot()).toEqual(snapshot)
    window.localStorage.setItem(AGENT_HUB_SESSION_STORAGE_KEY, '{broken')
    expect(readAgentHubSessionRecord()).toEqual({ status: 'damaged', snapshot: null })
    window.localStorage.setItem(
      AGENT_HUB_SESSION_STORAGE_KEY,
      JSON.stringify({ version: 9, windows: snapshot.windows })
    )
    expect(readAgentHubSessionRecord()).toEqual({ status: 'unsupported', snapshot: null })
  })
  it('salvages damaged entries, dedupes all ownership and repairs active ids', () => {
    const a = saved('a')
    const parsed = parseAgentHubSessionSnapshot({
      ...snapshot,
      windows: [
        {
          ...a,
          tabs: [
            null,
            a.tabs[0],
            { ...saved('bad').tabs[0], hostIdentity: 'ssh:host|other-workspace' }
          ],
          activeTabId: 'missing',
          geometry: { x: 0, y: 0, width: Number.NaN, height: 10 }
        },
        saved('duplicate', 'a'),
        { ...saved('b'), tabs: [] },
        saved('a', 'another'),
        saved('c')
      ]
    })
    expect(parsed?.windows.map((window) => window.id)).toEqual(['a', 'c'])
    expect(parsed?.windows[0]).toMatchObject({ activeTabId: 'entry-a', geometry: null })
    expect(parsed?.canvasParked).toEqual([])
  })
  it('bounds raw arrays before parsing and retains at most 10 entries in one window', () => {
    const windows = Array.from({ length: 40 }, (_, i) => ({
      ...saved(`w${i}`),
      tabs: Array.from({ length: 12 }, (_, j) => saved(`w${i}-${j}`).tabs[0])
    }))
    const parsed = parseAgentHubSessionSnapshot({
      version: 2,
      windows,
      hiddenFamilyRoots: Array.from({ length: 300 }, (_, i) => `${i}`)
    })
    expect(parsed?.windows).toHaveLength(26)
    expect(parsed?.windows.reduce((count, window) => count + window.tabs.length, 0)).toBe(256)
    expect(parsed?.windows.every((window) => window.tabs.length <= 10)).toBe(true)
    expect(parsed?.hiddenFamilyRoots).toHaveLength(256)
    expect(parseAgentHubSessionSnapshot({ version: 3, windows })).toBeNull()
  })
  it('distinguishes absent storage and clears both versions', () => {
    expect(readAgentHubSessionRecord()).toEqual({ status: 'absent', snapshot: null })
    window.localStorage.setItem(AGENT_HUB_LEGACY_SESSION_STORAGE_KEY, '{}')
    writeAgentHubSessionSnapshot(snapshot)
    clearAgentHubSessionSnapshot()
    expect(window.localStorage.getItem(AGENT_HUB_LEGACY_SESSION_STORAGE_KEY)).toBeNull()
    expect(readAgentHubSessionRecord().status).toBe('absent')
  })
  it('handles blocked storage without losing the legacy record or throwing', () => {
    window.localStorage.setItem(AGENT_HUB_LEGACY_SESSION_STORAGE_KEY, 'legacy')
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('full')
    })
    expect(writeAgentHubSessionSnapshot(snapshot)).toBe(false)
    expect(window.localStorage.getItem(AGENT_HUB_LEGACY_SESSION_STORAGE_KEY)).toBe('legacy')
  })
  it('ignores removed auto-popout marks rather than restoring old automation', () => {
    expect(parseAgentHubSessionSnapshot({ ...snapshot, autoPopoutTabIds: ['a'] })).toEqual(snapshot)
  })
})

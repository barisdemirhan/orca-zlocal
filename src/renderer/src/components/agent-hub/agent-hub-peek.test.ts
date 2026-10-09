/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const state: {
    settings: { experimentalAgentHub: boolean }
    connectionId: string | null | undefined
  } = {
    settings: { experimentalAgentHub: true },
    connectionId: null
  }
  return state
})

vi.mock('@/store', () => ({ useAppStore: { getState: () => ({ settings: mocks.settings }) } }))
vi.mock('@/lib/connection-context', () => ({ getConnectionIdForFile: () => mocks.connectionId }))
vi.mock('@/components/editor/markdown-internal-links', () => ({
  absolutePathToFileUri: (path: string) => `file://${path}`
}))

import {
  agentHubPeekFileAction,
  agentHubPeekUrlAction,
  peekTerminalFileFromMirror,
  peekTerminalUrlFromMirror,
  type AgentHubPeekLinkSource
} from './agent-hub-peek-routing'
import {
  closeAgentHubPeek,
  goBackAgentHubPeek,
  readAgentHubPeek,
  registerAgentHubPeekHost
} from './agent-hub-peek-store'

let unregisterHost = (): void => undefined

function clickIn(mirrorKey: string | null): MouseEvent {
  const terminal = document.createElement('div')
  if (mirrorKey) {
    const mirror = document.createElement('section')
    mirror.setAttribute('data-agent-hub-mirror', '')
    mirror.dataset.agentHubMirrorKey = mirrorKey
    mirror.append(terminal)
    document.body.append(mirror)
  } else {
    document.body.append(terminal)
  }
  const event = new MouseEvent('click', { metaKey: true })
  Object.defineProperty(event, 'target', { value: terminal })
  return event
}

function source(event: MouseEvent | undefined, local = true): AgentHubPeekLinkSource {
  return { worktreeId: 'wt-1', local, event, openInWorkspace: vi.fn(), openExternally: null }
}

const shown = () => {
  const peek = readAgentHubPeek()
  return peek ? peek.history[peek.index] : null
}

beforeEach(() => {
  mocks.settings = { experimentalAgentHub: true }
  mocks.connectionId = null
  unregisterHost = registerAgentHubPeekHost()
})
afterEach(() => {
  unregisterHost()
  closeAgentHubPeek()
  document.body.replaceChildren()
})

describe('a direct click in a mirror', () => {
  it('peeks at a page and names the mirror it came from', () => {
    expect(peekTerminalUrlFromMirror('http://127.0.0.1:6007/', source(clickIn('m-1')))).toBe(true)
    expect(shown()).toMatchObject({
      content: { kind: 'web', url: 'http://127.0.0.1:6007/' },
      title: '127.0.0.1:6007',
      mirrorKey: 'm-1'
    })
  })

  it.each([
    ['/a/contact-tr.png', { kind: 'image', filePath: '/a/contact-tr.png' }],
    ['/a/store-review.PDF', { kind: 'pdf' }],
    ['/a/flow.mp4', { kind: 'media' }],
    ['/a/report.html', { kind: 'web', url: 'file:///a/report.html' }]
  ])('peeks at %s', (filePath, content) => {
    expect(peekTerminalFileFromMirror(filePath, source(clickIn('m-1')))).toBe(true)
    expect(shown()?.content).toMatchObject(content)
  })

  it.each([
    ['outside a mirror', () => clickIn(null), true, '/a/shot.png', null],
    ['with Agent Hub off', () => clickIn('m-1'), false, '/a/shot.png', null],
    ['for a file Peek cannot show', () => clickIn('m-1'), true, '/a/main.ts', null],
    ['for a file on an SSH host', () => clickIn('m-1'), true, '/a/shot.png', 'ssh-1'],
    ['before the file owner has loaded', () => clickIn('m-1'), true, '/a/shot.png', undefined]
  ])('leaves the click to Orca %s', (_, event, enabled, filePath, connectionId) => {
    mocks.settings = { experimentalAgentHub: enabled }
    mocks.connectionId = connectionId
    expect(peekTerminalFileFromMirror(filePath, source(event()))).toBe(false)
    expect(readAgentHubPeek()).toBeNull()
  })
})

it('leaves a page from an SSH or paired-runtime terminal to Orca', () => {
  expect(peekTerminalUrlFromMirror('http://localhost:5173/', source(clickIn('m-1'), false))).toBe(
    false
  )
  expect(readAgentHubPeek()).toBeNull()
})

describe('the link menu row', () => {
  it('is offered in any terminal while Agent Hub is on and opens Peek', () => {
    const row = agentHubPeekUrlAction('https://example.com/run/1', source(clickIn(null)))
    expect(row?.label).toBe('Peek')
    void row?.run()
    expect(shown()).toMatchObject({ content: { kind: 'web' }, mirrorKey: null })
  })

  it('is absent with Agent Hub off', () => {
    mocks.settings = { experimentalAgentHub: false }
    expect(agentHubPeekFileAction('/a/shot.png', source(undefined))).toBeNull()
  })

  it('is absent while nothing can show a Peek', () => {
    unregisterHost()
    unregisterHost = () => undefined
    expect(agentHubPeekFileAction('/a/shot.png', source(undefined))).toBeNull()
  })
})

describe('one Peek at a time', () => {
  it('replaces what is shown, steps back, and treats a repeat as the same step', () => {
    const at = (path: string): boolean => peekTerminalFileFromMirror(path, source(clickIn('m-1')))
    at('/a/one.png')
    at('/a/two.pdf')
    at('/a/two.pdf')
    expect(readAgentHubPeek()?.history.map((item) => item.location)).toEqual([
      '/a/one.png',
      '/a/two.pdf'
    ])
    goBackAgentHubPeek()
    expect(shown()?.location).toBe('/a/one.png')
    at('/a/three.mp4')
    expect(readAgentHubPeek()?.history.map((item) => item.location)).toEqual([
      '/a/one.png',
      '/a/three.mp4'
    ])
    closeAgentHubPeek()
    expect(readAgentHubPeek()).toBeNull()
  })
})

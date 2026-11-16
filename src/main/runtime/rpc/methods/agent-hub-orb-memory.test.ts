import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrcaRuntimeService } from '../../orca-runtime'
import type { RuntimeClientEvent } from '../../../../shared/remote-runtime/session-graph/runtime-client-events'
import { AgentHubLedger } from '../../agent-hub/agent-hub-ledger'
import { AGENT_HUB_METHODS } from './agent-hub'
import { AGENT_HUB_ORB_MEMORY_METHODS } from './agent-hub-orb-memory'
import { readAgentHubDelivery } from '../../../../shared/rpc-contract/agent-hub-events'
import { AGENT_HUB_REQUESTS_CAPABILITY } from '../../../../shared/agent-hub-capabilities'
import type { AgentHubOrbMemoryEntry } from '../../../../shared/agent-hub-orb-identity'

const files = vi.hoisted(() => ({
  append: vi.fn(async (_text: string, _date: Date) => {}),
  read: vi.fn(async (): Promise<AgentHubOrbMemoryEntry[]> => [])
}))
vi.mock('../../../agent-hub/orb/agent-hub-orb-identity-files', () => ({
  appendAgentHubOrbMemory: files.append,
  readAgentHubOrbMemory: files.read
}))

const pane = { paneKey: 'pane-1', terminalHandle: 'term-1' }
let ledger: AgentHubLedger
let events: RuntimeClientEvent[]
let suggestions: boolean
let runtime: OrcaRuntimeService
const remember = AGENT_HUB_ORB_MEMORY_METHODS[0]
const respond = AGENT_HUB_METHODS.find((method) => method.name === 'agentHub.respond')
const desktop = {
  caller: { kind: 'desktop' as const },
  connectionId: 'local',
  clientKind: 'runtime' as const,
  clientCapabilities: [AGENT_HUB_REQUESTS_CAPABILITY]
}

function propose(text: string, session = 'codex_orb') {
  return remember.handler(remember.params.parse({ callerSessionId: session, text }), {
    runtime,
    caller: { kind: 'local-cli' }
  })
}
function lastMemory() {
  const event = readAgentHubDelivery(events.at(-1))
  if (!event || event.kind !== 'memory') {
    throw new Error('No memory proposal was delivered')
  }
  return event
}
function decide(requestId: string, decision: 'remember' | 'decline', text: string) {
  if (!respond) {
    throw new Error('Missing respond')
  }
  return respond.handler(
    { requestId, result: { kind: 'memory', decision, text } },
    { runtime, ...desktop }
  )
}

beforeEach(() => {
  events = []
  suggestions = true
  files.append.mockClear()
  files.read.mockReset().mockResolvedValue([])
  ledger = new AgentHubLedger((event) => events.push({ type: 'agentHub', event }))
  ledger.registerDesktop('local')
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: these handlers use only the ledger, Orb session lookup and pane lookup.
  runtime = {
    agentHub: ledger,
    agentHubOrb: { current: () => ({ sessionId: 'codex_orb', resumed: false }) },
    isAgentHubOrbMemorySuggestionsEnabled: () => suggestions,
    getAgentHubCaller: (handle: string) => (handle === pane.terminalHandle ? pane : null),
    getTerminalHandleForPaneKey: () => null
  } as unknown as OrcaRuntimeService
})
afterEach(() => ledger.dispose())

describe('Orb memory proposals', () => {
  it('returns at once, writes only the text the user approved, and refuses a repeat afterwards', async () => {
    await expect(propose('Prefers short answers')).resolves.toMatchObject({ proposed: true })
    const proposal = lastMemory()
    expect(proposal).toMatchObject({ caller: { kind: 'orb' }, text: 'Prefers short answers' })
    expect(files.append).not.toHaveBeenCalled()

    await decide(proposal.requestId, 'remember', 'Prefers short, plain answers')
    expect(files.append).toHaveBeenCalledWith('Prefers short, plain answers', expect.any(Date))

    files.read.mockResolvedValue([
      { line: '- [2026-10-23] Prefers short answers', text: 'Prefers short answers', date: null }
    ])
    await expect(propose('prefers  SHORT answers')).rejects.toMatchObject({
      code: 'invalid_argument'
    })
  })

  it('writes nothing on decline and does not propose the same text again', async () => {
    await propose('No builds after 8pm')
    await decide(lastMemory().requestId, 'decline', 'No builds after 8pm')
    expect(files.append).not.toHaveBeenCalled()
    await expect(propose('no builds after 8pm')).rejects.toMatchObject({ code: 'invalid_argument' })
  })

  it('refuses a pending duplicate, a non-Orb caller and a turned-off setting', async () => {
    await propose('Use pnpm')
    await expect(propose('Use pnpm')).rejects.toMatchObject({ code: 'invalid_argument' })
    await expect(
      remember.handler(
        remember.params.parse({ callerTerminalHandle: 'term-1', text: 'Use yarn' }),
        {
          runtime,
          caller: { kind: 'local-cli' }
        }
      )
    ).rejects.toMatchObject({ message: 'Only the Orb can propose a memory' })
    suggestions = false
    await expect(propose('Another fact')).rejects.toMatchObject({ code: 'disabled_by_user' })
  })
})

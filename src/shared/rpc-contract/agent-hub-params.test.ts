import { describe, expect, it } from 'vitest'
import {
  AgentHubNotifyParams,
  AgentHubPeekParams,
  AgentHubAskParams,
  AgentHubProgressParams,
  AgentHubPresenceParams,
  AgentHubStatusParams,
  AgentHubMirrorParams,
  AgentHubArrangeParams,
  AgentHubCanvasParams,
  AgentHubRespondParams
} from './agent-hub-params'

const caller = { callerTerminalHandle: 'term-1' }
const requestId = '93b0c108-34c6-4e45-9d13-d8f4170d7456'
describe('Agent Hub RPC parameter admission', () => {
  it.each([
    [
      'notify',
      AgentHubNotifyParams,
      { ...caller, text: 'Ready', links: ['/remote/file'] },
      { ...caller, text: 'Ready', level: 'warning' }
    ],
    [
      'peek',
      AgentHubPeekParams,
      { ...caller, link: 'https://example.com' },
      { ...caller, link: '' }
    ],
    [
      'ask',
      AgentHubAskParams,
      { ...caller, question: 'Go?', options: ['Yes', 'No'] },
      { ...caller, question: 'Go?', options: ['Yes'], recommended: 2 }
    ],
    [
      'progress',
      AgentHubProgressParams,
      { ...caller, clear: true },
      { ...caller, text: 'x'.repeat(81) }
    ],
    ['presence', AgentHubPresenceParams, caller, {}],
    ['status', AgentHubStatusParams, { callerPaneKey: 'pane-1' }, {}],
    [
      'mirror',
      AgentHubMirrorParams,
      { ...caller, action: 'restore', terminal: 'term-2' },
      { ...caller, action: 'kill' }
    ],
    ['arrange', AgentHubArrangeParams, { ...caller, layout: 'grid' }, { ...caller, layout: '' }],
    [
      'canvas',
      AgentHubCanvasParams,
      { ...caller, action: 'open' },
      { ...caller, action: 'activate' }
    ],
    [
      'respond',
      AgentHubRespondParams,
      { requestId, result: { kind: 'consent', decision: 'once' } },
      { requestId, result: { kind: 'consent', decision: 'always' } }
    ]
  ])('validates the %s wire contract', (_name, schema, valid, invalid) => {
    expect(schema.safeParse(valid).success).toBe(true)
    expect(schema.safeParse(invalid).success).toBe(false)
  })

  it('retains default ask timeout and refuses unsafe resume/default combinations', () => {
    expect(
      AgentHubAskParams.parse({ ...caller, question: 'Go?', options: ['Yes'] }).timeoutMs
    ).toBe(1_800_000)
    expect(AgentHubAskParams.safeParse({ ...caller, resume: requestId }).success).toBe(true)
    for (const invalid of [
      { question: 'Go?', options: ['Yes'], ifAway: 'recommended' },
      { resume: requestId, question: 'Another?', options: ['Yes'] },
      { question: 'Go?', options: ['Yes'], timeoutMs: 86_400_001 },
      { question: 'Go?', options: [] }
    ]) {
      expect(AgentHubAskParams.safeParse({ ...caller, ...invalid }).success).toBe(false)
    }
  })

  it('requires text or clear exclusively and rejects malformed desktop answers', () => {
    expect(
      AgentHubProgressParams.safeParse({ ...caller, text: 'Building', clear: true }).success
    ).toBe(false)
    expect(AgentHubProgressParams.safeParse(caller).success).toBe(false)
    expect(
      AgentHubRespondParams.safeParse({
        requestId,
        result: { kind: 'presence', present: true, idleMinutes: -1 }
      }).success
    ).toBe(false)
    expect(
      AgentHubRespondParams.safeParse({
        requestId,
        result: { kind: 'ask', answer: 'Yes', index: 0 }
      }).success
    ).toBe(false)
  })
})

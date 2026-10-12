import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { RuntimeClient, RuntimeClientError } from '../runtime-client'
import { normalizeCommandPositionals, parseArgs, specPaths } from '../args'
import { AGENT_HUB_COMMAND_SPECS } from '../specs/agent-hub'
import { AGENT_HUB_HANDLERS } from './agent-hub'

let client: RuntimeClient
let call: MockInstance<RuntimeClient['call']>
let log: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  vi.stubEnv('ORCA_TERMINAL_HANDLE', 'term-self')
  vi.stubEnv('ORCA_PANE_KEY', 'pane-fallback')
  client = new RuntimeClient('/agent-hub-cli-fixture', 60_000, null, null)
  call = vi.spyOn(client, 'call').mockResolvedValue({
    id: 'req-1',
    ok: true,
    result: { requestId: 'hub-id', answer: 'Yes' },
    _meta: { runtimeId: 'host-1' }
  })
  log = vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

async function run(argv: string[], json = false): Promise<void> {
  const parsed = normalizeCommandPositionals(
    AGENT_HUB_COMMAND_SPECS,
    parseArgs(argv, AGENT_HUB_COMMAND_SPECS.flatMap(specPaths), AGENT_HUB_COMMAND_SPECS)
  )
  const handler = AGENT_HUB_HANDLERS[parsed.commandPath.join(' ')]
  if (!handler) {
    throw new Error('Missing handler')
  }
  await handler({ flags: parsed.flags, client, cwd: '/workspace', json })
}

describe('hub CLI', () => {
  it('parses notification flags and preserves every link with the caller separate from the target', async () => {
    await run(
      [
        'hub',
        'notify',
        'Ready',
        '--sound',
        '--level',
        'done',
        '--link',
        'https://example.com',
        '--link',
        '/host/file',
        '--terminal',
        'term-other'
      ],
      true
    )
    expect(call).toHaveBeenCalledWith(
      'agentHub.notify',
      expect.objectContaining({
        callerTerminalHandle: 'term-self',
        terminal: 'term-other',
        text: 'Ready',
        sound: true,
        level: 'done',
        links: ['https://example.com', '/host/file']
      }),
      { timeoutMs: 35_000 }
    )
    expect(JSON.parse(String(log.mock.calls[0][0]))).toMatchObject({
      ok: true,
      _meta: { runtimeId: 'host-1' }
    })
  })

  it('defaults to its own pane and uses the stable pane key only when no handle was injected', async () => {
    await run(['hub', 'peek', '/remote/path'])
    expect(call).toHaveBeenLastCalledWith(
      'agentHub.peek',
      expect.objectContaining({
        callerTerminalHandle: 'term-self',
        terminal: undefined,
        link: '/remote/path'
      }),
      expect.anything()
    )
    vi.stubEnv('ORCA_TERMINAL_HANDLE', '')
    await run(['hub', 'presence'])
    expect(call).toHaveBeenLastCalledWith(
      'agentHub.presence',
      expect.objectContaining({ callerPaneKey: 'pane-fallback', terminal: undefined }),
      expect.anything()
    )
    vi.stubEnv('ORCA_PANE_KEY', '')
    const calls = call.mock.calls.length
    await expect(run(['hub', 'status'])).rejects.toMatchObject({ code: 'invalid_argument' })
    expect(call).toHaveBeenCalledTimes(calls)
  })

  it('blocks for the host answer and extends the transport timeout beyond the requested deadline', async () => {
    await run([
      'hub',
      'ask',
      'Proceed?',
      '--option',
      'Yes',
      '--option',
      'No',
      '--recommended',
      '2',
      '--multi',
      '--timeout',
      '2m',
      '--if-away',
      'recommended'
    ])
    expect(call).toHaveBeenCalledWith(
      'agentHub.ask',
      expect.objectContaining({
        question: 'Proceed?',
        options: ['Yes', 'No'],
        recommended: 2,
        multi: true,
        timeoutMs: 120_000,
        ifAway: 'recommended',
        requestId: expect.any(String)
      }),
      { timeoutMs: 135_000 }
    )
    expect(log).toHaveBeenCalledWith('Yes')
  })

  it('resumes the same ID without creating another question', async () => {
    const resume = '93b0c108-34c6-4e45-9d13-d8f4170d7456'
    await run(['hub', 'ask', '--resume', resume])
    expect(call).toHaveBeenCalledWith(
      'agentHub.ask',
      expect.objectContaining({ resume, requestId: undefined, question: undefined }),
      { timeoutMs: 86_415_000 }
    )
  })

  it('returns recovery information if the transport disconnects during an ask', async () => {
    call.mockRejectedValue(new RuntimeClientError('connection_lost', 'Connection closed'))
    await expect(run(['hub', 'ask', 'Go?', '--option', 'Yes'])).rejects.toMatchObject({
      code: 'connection_lost',
      message: expect.stringContaining('hub ask --resume'),
      data: { requestId: expect.any(String) }
    })
  })

  it.each([
    ['hub', 'ask', 'Go?', '--option', 'Yes', '--recommended', '2'],
    ['hub', 'ask', 'Go?', '--option', 'Yes', '--timeout', 'forever'],
    ['hub', 'ask', 'Go?', '--option', 'Yes', '--if-away', 'recommended'],
    ['hub', 'progress', 'x'.repeat(81)],
    ['hub', 'progress', 'Building', '--clear']
  ])('rejects invalid arguments before sending %j', async (...argv) => {
    await expect(run(argv)).rejects.toMatchObject({ code: 'invalid_argument' })
    expect(call).not.toHaveBeenCalled()
  })

  it.each(['no_desktop', 'denied_by_user', 'timeout', 'disabled_by_user'])(
    'preserves the %s failure for the CLI exit handler',
    async (code) => {
      call.mockRejectedValue(new RuntimeClientError(code, `Hub: ${code}`))
      await expect(run(['hub', 'status'])).rejects.toMatchObject({ code, message: `Hub: ${code}` })
      expect(log).not.toHaveBeenCalled()
    }
  )

  it('reports rate limit retry timing and explains an unsupported host', async () => {
    call.mockRejectedValue(
      new RuntimeClientError('rate_limited', 'Slow down', { retryAfterMs: 12_000 })
    )
    await expect(run(['hub', 'notify', 'Ready'])).rejects.toMatchObject({
      code: 'rate_limited',
      message: 'Slow down (retry after 12000ms)',
      data: { retryAfterMs: 12_000 }
    })
    call.mockRejectedValue(new RuntimeClientError('method_not_found', 'Unknown method'))
    await expect(run(['hub', 'status'])).rejects.toMatchObject({
      code: 'unsupported_host',
      message: 'This Orca version does not support hub commands'
    })
  })

  it.each([
    [['hub', 'progress', '--clear'], 'agentHub.progress', { clear: true }],
    [['hub', 'mirror', 'add'], 'agentHub.mirror', { action: 'add' }],
    [
      ['hub', 'mirror', 'close', '--terminal', 'other'],
      'agentHub.mirror',
      { action: 'close', terminal: 'other' }
    ],
    [['hub', 'arrange', '--layout', 'grid'], 'agentHub.arrange', { layout: 'grid' }],
    [['hub', 'canvas', 'open'], 'agentHub.canvas', { action: 'open' }]
  ])('dispatches %j through its host', async (argv, method, content) => {
    await run(argv)
    expect(call).toHaveBeenCalledWith(method, expect.objectContaining(content), expect.anything())
  })
})

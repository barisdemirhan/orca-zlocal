import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { RuntimeClient, RuntimeClientError } from '../runtime-client'
import { normalizeCommandPositionals, parseArgs, specPaths } from '../args'
import { AGENT_HUB_COMMAND_SPECS } from '../specs/agent-hub'
import { AGENT_HUB_HANDLERS } from './agent-hub'
import { formatCommandHelp } from '../help'
import { quoteCliCommandArgument } from '../shell-command-quote'

let client: RuntimeClient
let call: MockInstance<RuntimeClient['call']>
const initialExitCode = process.exitCode
let log: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  process.exitCode = undefined
  vi.stubEnv('ORCA_TERMINAL_HANDLE', 'term-self')
  vi.stubEnv('ORCA_PANE_KEY', 'pane-fallback')
  vi.stubEnv('ORCA_AGENT_SESSION_ID', '')
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
  process.exitCode = initialExitCode
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
  it('uses a pane-less Orb session identity for Hub commands and returns its answer to the calling agent', async () => {
    vi.stubEnv('ORCA_TERMINAL_HANDLE', '')
    vi.stubEnv('ORCA_AGENT_SESSION_ID', 'codex_orb')
    await run(['hub', 'ask', 'Proceed?', '--option', 'Yes', '--option', 'No'])
    expect(call).toHaveBeenLastCalledWith(
      'agentHub.ask',
      expect.objectContaining({
        callerSessionId: 'codex_orb',
        callerTerminalHandle: undefined,
        callerPaneKey: undefined
      }),
      expect.anything()
    )
    expect(log).toHaveBeenCalledWith('Yes')
    vi.stubEnv('ORCA_TERMINAL_HANDLE', 'term-self')
    await run(['hub', 'status'])
    expect(call).toHaveBeenLastCalledWith(
      'agentHub.status',
      expect.objectContaining({
        callerTerminalHandle: 'term-self',
        callerSessionId: undefined
      }),
      expect.anything()
    )
  })
  it('reports missing Peek input as a usage error before contacting the host', async () => {
    await expect(run(['hub', 'peek'])).rejects.toMatchObject({
      code: 'invalid_argument',
      message: 'Missing <url|path>. Usage: orca hub peek <url|path>'
    })
    expect(call).not.toHaveBeenCalled()
  })
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

  it('keeps the question lifetime separate from the default CLI wait', async () => {
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
        waitMs: 100_000,
        ifAway: 'recommended',
        requestId: expect.any(String)
      }),
      { timeoutMs: 105_000 }
    )
    expect(log).toHaveBeenCalledWith('Yes')
  })

  it('resolves Peek files in the calling CLI directory while preserving URLs', async () => {
    await run(['hub', 'peek', 'screens/image.png'])
    expect(call).toHaveBeenLastCalledWith(
      'agentHub.peek',
      expect.objectContaining({ link: '/workspace/screens/image.png' }),
      expect.anything()
    )
    await run(['hub', 'peek', 'https://example.com/image.png'])
    expect(call).toHaveBeenLastCalledWith(
      'agentHub.peek',
      expect.objectContaining({ link: 'https://example.com/image.png' }),
      expect.anything()
    )
  })

  it('resumes the same ID without creating another question', async () => {
    const resume = '93b0c108-34c6-4e45-9d13-d8f4170d7456'
    await run(['hub', 'ask', '--resume', resume])
    expect(call).toHaveBeenCalledWith(
      'agentHub.ask',
      expect.objectContaining({ resume, requestId: undefined, question: undefined }),
      { timeoutMs: 105_000 }
    )
  })

  it('returns pending JSON with a same-host resume command and exit 2', async () => {
    const requestId = '93b0c108-34c6-4e45-9d13-d8f4170d7456'
    call.mockResolvedValueOnce({
      id: 'r',
      ok: true,
      result: { status: 'pending', requestId },
      _meta: { runtimeId: 'host-1' }
    })
    await run(['hub', 'ask', '--resume', requestId, '--wait', '2s', '--environment', 'workhost'], true)
    expect(call).toHaveBeenCalledWith(
      'agentHub.ask',
      expect.objectContaining({ resume: requestId, waitMs: 2_000 }),
      { timeoutMs: 7_000 }
    )
    expect(JSON.parse(String(log.mock.calls[0][0]))).toEqual({
      status: 'pending',
      requestId,
      resume: ['orca', 'hub', 'ask', '--resume', requestId, '--environment', 'workhost']
    })
    expect(process.exitCode).toBe(2)
  })

  it('caps the default wait to a short question lifetime and keeps host timeout distinct from pending', async () => {
    await run(['hub', 'ask', 'Go?', '--option', 'Yes', '--timeout', '3s'])
    expect(call).toHaveBeenCalledWith(
      'agentHub.ask',
      expect.objectContaining({ timeoutMs: 3_000, waitMs: 3_000 }),
      { timeoutMs: 8_000 }
    )
    call.mockRejectedValueOnce(new RuntimeClientError('timeout', 'Hub question timed out'))
    await expect(run(['hub', 'ask', 'Go?', '--option', 'Yes'])).rejects.toMatchObject({
      code: 'timeout'
    })
    expect(process.exitCode).toBeUndefined()
  })

  it('prints a recovery command when an older host ignores the bounded wait', async () => {
    call.mockRejectedValueOnce(new RuntimeClientError('runtime_timeout', 'Transport wait ended'))
    await run(['hub', 'ask', 'Go?', '--option', 'Yes', '--wait', '1s'])
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Still waiting'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('orca hub ask --resume'))
    expect(process.exitCode).toBe(2)
  })

  it('prints a shell-safe same-host resume command and documents both exit codes', async () => {
    call.mockRejectedValueOnce(new RuntimeClientError('runtime_timeout', 'Transport wait ended'))
    await run(['hub', 'ask', 'Go?', '--option', 'Yes', '--environment', 'Host with spaces'])
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(`--environment ${quoteCliCommandArgument('Host with spaces')}`)
    )
    const spec = AGENT_HUB_COMMAND_SPECS.find((entry) => entry.path.join(' ') === 'hub ask')
    if (!spec) {
      throw new Error('Missing ask spec')
    }
    const help = formatCommandHelp(spec)
    expect(help).toContain('--wait <duration>')
    expect(help).toContain('Exit 2 means still pending')
    expect(help).toContain('Exit 1 means the host timeout expired')
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
    ['hub', 'ask', 'Go?', '--option', 'Yes', '--wait', 'forever'],
    ['hub', 'ask', 'Go?', '--option', 'Yes', '--timeout', '2s', '--wait', '3s'],
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

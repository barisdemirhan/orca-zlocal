import { describe, expect, it, vi } from 'vitest'

const {
  callMock,
  runtimeClientConstructorMock,
  serveOrcaAppMock,
  getDefaultUserDataPathMock,
  addEnvironmentFromPairingCodeMock,
  listEnvironmentsMock,
  spawnMock
} = vi.hoisted(() => ({
  callMock: vi.fn(),
  runtimeClientConstructorMock: vi.fn(),
  serveOrcaAppMock: vi.fn(),
  getDefaultUserDataPathMock: vi.fn(() => '/tmp/orca-user-data'),
  addEnvironmentFromPairingCodeMock: vi.fn(),
  listEnvironmentsMock: vi.fn(),
  spawnMock: vi.fn()
}))

vi.mock('./runtime/client', async () => {
  const { createRuntimeClientModuleMock } = await import('./index-test-harness.js')
  return createRuntimeClientModuleMock({
    callMock,
    runtimeClientConstructorMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock
  })
})

vi.mock('./runtime/launch', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  serveOrcaApp: serveOrcaAppMock
}))

vi.mock('./runtime/metadata', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getDefaultUserDataPath: getDefaultUserDataPathMock
}))

vi.mock('../shared/remote-runtime/host-store/runtime-environment-store', async (original) => ({
  ...(await original<object>()),
  listEnvironments: listEnvironmentsMock
}))

vi.mock('./runtime/environments', () => ({
  addEnvironmentFromPairingCode: addEnvironmentFromPairingCodeMock,
  listEnvironments: listEnvironmentsMock,
  removeEnvironment: vi.fn(),
  resolveEnvironment: vi.fn()
}))

vi.mock('child_process', async () => {
  const { createChildProcessModuleMock } = await import('./index-test-harness.js')
  return createChildProcessModuleMock(spawnMock)
})

import { main } from './index'
import { RuntimeClientError } from './runtime/types'
import { okFixture } from './runtime/fixtures/runtime-rpc-fixtures'
import { useWorktreeAwarenessEnvironment } from './index-test-harness'

const QUESTION = {
  questionId: 'p_9c41e0b27a5d13f8c6aa',
  source: 'agent-prompt',
  kind: 'question',
  question: 'Which color?',
  options: [
    { id: '1', label: 'Red' },
    { id: '2', label: 'Blue' }
  ],
  paneKey: 'tab-1:pane-1',
  terminal: 'term-1',
  worktreeId: 'repo-1::/work/a',
  agent: 'claude',
  answerable: true
}

const WAITING_ON_OLD_HOST = {
  worktreeId: 'repo-2::/srv/app',
  displayName: 'app',
  agents: [
    {
      paneKey: 'tab-9:pane-9',
      state: 'waiting',
      agentType: 'claude',
      toolName: 'AskUserQuestion',
      stateStartedAt: 5
    },
    {
      paneKey: 'tab-9:pane-8',
      state: 'working',
      agentType: 'codex',
      toolName: null,
      stateStartedAt: 6
    }
  ]
}

describe('orca hub questions and hub answer', () => {
  useWorktreeAwarenessEnvironment({
    callMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock,
    addEnvironmentFromPairingCodeMock,
    listEnvironmentsMock,
    spawnMock
  })

  it('reports each host on its own and never claims coverage an old or unreachable host lacks', async () => {
    listEnvironmentsMock.mockReturnValue([
      { id: 'env-workhost', name: 'workhost' },
      { id: 'env-desk', name: 'desk' }
    ])
    // Calls start in host order: local, workhost, desk; workhost's fallback listing comes last.
    callMock
      .mockResolvedValueOnce(
        okFixture('req_local', {
          questionsVersion: 1,
          questions: [QUESTION],
          hostScope: { hostIds: ['local'], omittedHostIds: [] }
        })
      )
      .mockRejectedValueOnce(new RuntimeClientError('method_not_found', 'Unknown method'))
      .mockRejectedValueOnce(new RuntimeClientError('runtime_unavailable', 'connect ETIMEDOUT'))
      .mockResolvedValueOnce(
        okFixture('req_ps', { worktrees: [WAITING_ON_OLD_HOST], totalCount: 1, truncated: false })
      )
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(['hub', 'questions', '--all-hosts', '--json'], '/tmp/repo')

    expect(runtimeClientConstructorMock.mock.calls.slice(-3)).toEqual([
      [null, null],
      [null, 'env-workhost'],
      [null, 'env-desk']
    ])
    expect(callMock.mock.calls.map(([method, params]) => [method, params])).toEqual([
      ['agentHub.questions', {}],
      ['agentHub.questions', {}],
      ['agentHub.questions', {}],
      ['worktree.ps', undefined]
    ])
    const { result } = JSON.parse(String(logSpy.mock.calls[0]?.[0]))
    expect(result.complete).toBe(false)
    expect(result.hosts).toMatchObject([
      {
        host: 'local',
        status: 'ok',
        complete: true,
        questions: [
          {
            questionId: QUESTION.questionId,
            answerArgv: [
              'orca',
              'hub',
              'answer',
              '--question',
              QUESTION.questionId,
              '--option',
              '<id>'
            ]
          }
        ]
      },
      {
        host: 'workhost',
        status: 'unsupported',
        complete: false,
        error: { code: 'unsupported_host' },
        questions: [
          {
            questionId: 'pane:tab-9:pane-9',
            tool: 'AskUserQuestion',
            answerable: false,
            reason: 'host_unsupported'
          }
        ]
      },
      {
        host: 'desk',
        status: 'unreachable',
        complete: false,
        error: { code: 'runtime_unavailable' },
        questions: []
      }
    ])
    expect(result.hosts[1].questions).toHaveLength(1)
  })

  it('answers on the named host, exits 1 when refused, and never falls back on an old host', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    callMock.mockResolvedValueOnce(
      okFixture('req_answer', {
        outcome: 'refused',
        questionId: QUESTION.questionId,
        reason: 'already_answered',
        answeredOptionIds: ['2']
      })
    )

    await main(
      ['hub', 'answer', '--question', QUESTION.questionId, '--option', '1', '--verify', '0s'],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenLastCalledWith(
      'agentHub.answer',
      { questionId: QUESTION.questionId, optionIds: ['1'], verifyMs: 0 },
      { timeoutMs: 30_000 }
    )
    expect(String(logSpy.mock.calls[0]?.[0])).toBe(
      'Not answered: already_answered (answered earlier with 2)'
    )
    expect(process.exitCode).toBe(1)

    process.exitCode = undefined
    callMock.mockReset()
    callMock.mockRejectedValueOnce(new RuntimeClientError('method_not_found', 'Unknown method'))
    await main(['hub', 'answer', '--question', QUESTION.questionId, '--option', '1'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledTimes(1)
    expect(errorSpy.mock.calls.flat().join('\n')).toContain('cannot answer questions from the CLI')
    expect(process.exitCode).toBe(1)
  })
})

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { OrcaRuntimeService } from '../orca-runtime'
import { OrcaRuntimeRpcServer } from '../rpc/server/runtime-rpc'
import { readRuntimeMetadata } from '../rpc/server/runtime-metadata'
import { openFramedSession, waitFor } from '../rpc/server/runtime-rpc-test-harness'

const caller = { paneKey: 'pane-fixture', terminalHandle: 'term-fixture', agentType: 'codex' }
type CliHandler = (ctx: {
  client: unknown
  cwd: string
  json: boolean
  flags: Map<string, string | boolean>
}) => Promise<void>
type AgentHubCli = {
  RuntimeClient: new (
    userDataPath: string,
    timeoutMs: number,
    environment: null,
    pairing: null
  ) => unknown
  handlers: Record<string, CliHandler>
}

/** Loads the CLI by path so the node project does not pull CLI sources into its file list. */
async function loadAgentHubCli(): Promise<AgentHubCli> {
  const clientPath = '../../../cli/runtime/client'
  const handlersPath = '../../../cli/agents/agent-hub'
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: dynamic import of a module whose export is checked in the CLI project.
  const clientModule = (await import(clientPath)) as Pick<AgentHubCli, 'RuntimeClient'>
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: dynamic import of a module whose export is checked in the CLI project.
  const handlerModule = (await import(handlersPath)) as {
    AGENT_HUB_HANDLERS: Record<string, CliHandler>
  }
  return { RuntimeClient: clientModule.RuntimeClient, handlers: handlerModule.AGENT_HUB_HANDLERS }
}

async function host() {
  const cli = await loadAgentHubCli()
  const userDataPath = mkdtempSync(join(tmpdir(), 'orca-hub-rpc-'))
  const runtime = new OrcaRuntimeService()
  const lookup = vi.spyOn(runtime, 'getAgentHubCaller').mockReturnValue(caller)
  const unregister = runtime.agentHub.registerDesktop('fixture-desktop')
  const server = new OrcaRuntimeRpcServer({ runtime, userDataPath, keepaliveIntervalMs: 20 })
  const stop = async (): Promise<void> => {
    unregister()
    runtime.agentHub.dispose()
    lookup.mockRestore()
    try {
      await server.stop()
    } finally {
      rmSync(userDataPath, { recursive: true, force: true })
    }
  }
  try {
    await server.start()
  } catch (error) {
    await stop()
    throw error
  }
  const metadata = readRuntimeMetadata(userDataPath)
  const endpoint = metadata?.transports[0]?.endpoint
  if (!metadata || !endpoint) {
    await stop()
    throw new Error('Missing test transport')
  }
  return {
    runtime,
    client: new cli.RuntimeClient(userDataPath, 60_000, null, null),
    handlers: cli.handlers,
    request(params: unknown) {
      return openFramedSession(endpoint, {
        id: 'hub-rpc',
        authToken: metadata.authToken,
        method: 'agentHub.ask',
        params
      })
    },
    stop
  }
}

describe('Agent Hub ask over the local runtime socket', () => {
  it('returns CLI pending before the question deadline and resumes the same host question after an answer', async () => {
    const fixture = await host()
    const originalExitCode = process.exitCode
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const previousHandle = process.env.ORCA_TERMINAL_HANDLE
    process.env.ORCA_TERMINAL_HANDLE = caller.terminalHandle
    try {
      await fixture.handlers['hub ask']({
        client: fixture.client,
        cwd: '/workspace',
        json: true,
        flags: new Map([
          ['question', 'Go?'],
          ['option', 'Yes'],
          ['timeout', '5s'],
          ['wait', '50ms']
        ])
      })
      const pending: unknown = JSON.parse(String(log.mock.calls[0][0]))
      if (
        typeof pending !== 'object' ||
        pending === null ||
        !('requestId' in pending) ||
        typeof pending.requestId !== 'string'
      ) {
        throw new Error('Missing pending question')
      }
      expect(pending).toMatchObject({
        status: 'pending',
        resume: [
          process.platform === 'linux' ? 'orca-ide' : 'orca',
          'hub',
          'ask',
          '--resume',
          pending.requestId
        ]
      })
      expect(process.exitCode).toBe(2)
      expect(fixture.runtime.agentHub.snapshot().requests).toMatchObject([
        { kind: 'ask', requestId: pending.requestId }
      ])
      fixture.runtime.agentHub.respond(
        pending.requestId,
        { kind: 'ask', answer: 'Yes', index: 1 },
        'fixture-desktop'
      )
      await fixture.handlers['hub ask']({
        client: fixture.client,
        cwd: '/workspace',
        json: false,
        flags: new Map([
          ['resume', pending.requestId],
          ['wait', '50ms']
        ])
      })
      expect(log).toHaveBeenLastCalledWith('Yes')
      expect(fixture.runtime.agentHub.snapshot().requests).toEqual([])
    } finally {
      process.exitCode = originalExitCode
      if (previousHandle === undefined) {
        delete process.env.ORCA_TERMINAL_HANDLE
      } else {
        process.env.ORCA_TERMINAL_HANDLE = previousHandle
      }
      log.mockRestore()
      await fixture.stop()
    }
  })
  it('runs the CLI handler through its real runtime client and prints the human answer', async () => {
    const fixture = await host()
    const output = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.stubEnv('ORCA_TERMINAL_HANDLE', caller.terminalHandle)
    try {
      const command = fixture.handlers['hub ask']({
        client: fixture.client,
        cwd: process.cwd(),
        json: true,
        flags: new Map([
          ['question', 'Go?'],
          ['option', 'Yes'],
          ['timeout', '5s']
        ])
      })
      await waitFor(() =>
        fixture.runtime.agentHub.snapshot().requests.some((request) => request.kind === 'ask')
      )
      const request = fixture.runtime.agentHub
        .snapshot()
        .requests.find((item) => item.kind === 'ask')
      if (!request) {
        throw new Error('Missing CLI question')
      }
      fixture.runtime.agentHub.respond(
        request.requestId,
        { kind: 'ask', answer: 'Yes', index: 1 },
        'fixture-desktop'
      )
      await command
      expect(JSON.parse(String(output.mock.calls[0]?.[0]))).toMatchObject({
        ok: true,
        result: { answer: 'Yes', index: 1, by: 'human', desktop: 'fixture-desktop' }
      })
    } finally {
      output.mockRestore()
      vi.unstubAllEnvs()
      await fixture.stop()
    }
  })

  it('emits keepalives while waiting and returns a coded timeout', async () => {
    const fixture = await host()
    try {
      const session = fixture.request({
        callerTerminalHandle: caller.terminalHandle,
        question: 'Go?',
        options: ['Yes'],
        timeoutMs: 250
      })
      await session.done
      expect(session.frames.some((frame) => frame._keepalive === true)).toBe(true)
      expect(session.frames.filter((frame) => 'ok' in frame)).toEqual([
        expect.objectContaining({
          ok: false,
          error: expect.objectContaining({
            code: 'timeout',
            data: { requestId: expect.any(String) }
          })
        })
      ])
      expect(fixture.runtime.agentHub.snapshot().requests).toEqual([])
    } finally {
      await fixture.stop()
    }
  })

  it('retains a question across caller disconnect and resumes the human answer on a new socket', async () => {
    const fixture = await host()
    const requestId = '93b0c108-34c6-4e45-9d13-d8f4170d7456'
    const published: string[] = []
    const unsubscribe = fixture.runtime.onClientEvent((event) => {
      if (event.type === 'agentHub' && event.event.kind === 'ask') {
        published.push(event.event.requestId)
      }
    })
    try {
      const disconnected = fixture.request({
        callerTerminalHandle: caller.terminalHandle,
        question: 'Go?',
        options: ['Yes'],
        timeoutMs: 5_000,
        requestId
      })
      await waitFor(() => published.length > 0)
      disconnected.socket.destroy()
      await disconnected.done
      expect(fixture.runtime.agentHub.snapshot().requests).toMatchObject([
        { kind: 'ask', requestId }
      ])
      fixture.runtime.agentHub.respond(
        requestId,
        { kind: 'ask', answer: 'Yes', index: 1 },
        'fixture-desktop'
      )
      const resumed = fixture.request({
        callerTerminalHandle: caller.terminalHandle,
        resume: requestId
      })
      await resumed.done
      expect(resumed.frames.find((frame) => frame.ok === true)).toMatchObject({
        result: { requestId, answer: 'Yes', index: 1, by: 'human', desktop: 'fixture-desktop' }
      })
      expect(published).toEqual([requestId])
    } finally {
      unsubscribe()
      await fixture.stop()
    }
  })
})

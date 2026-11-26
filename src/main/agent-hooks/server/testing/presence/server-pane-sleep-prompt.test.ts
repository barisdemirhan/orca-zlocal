import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentHookServer } from '../../agent-hook-server'
import { PANE } from '../server.test-fixtures'

vi.mock('../../../../telemetry/client', () => ({ track: vi.fn() }))
vi.mock('../../../../telemetry/cohort-classifier', () => ({ getCohortAtEmit: () => ({}) }))

const QUESTION = JSON.stringify({ questions: [{ question: 'Which branch?', options: [] }] })

describe('a pane put to sleep while asking a question', () => {
  let server: AgentHookServer
  let userDataPath: string

  beforeEach(async () => {
    userDataPath = mkdtempSync(join(tmpdir(), 'orca-sleep-prompt-'))
    server = new AgentHookServer()
    await server.start({ env: 'production', userDataPath })
    server.setTerminalPaneLifecycle({
      ownsProcess: () => true,
      isStopping: () => false,
      isReversibleStop: () => true,
      isPlaced: () => true
    })
  })

  afterEach(() => {
    server.stop()
    rmSync(userDataPath, { recursive: true, force: true })
  })

  it('keeps the question beside the done, interrupted turn', () => {
    server.ingestTerminalStatus({
      paneKey: PANE,
      payload: {
        state: 'waiting',
        prompt: 'task',
        agentType: 'claude',
        toolName: 'AskUserQuestion',
        interactivePrompt: QUESTION
      }
    })
    expect(server.settleTerminalPaneSleep(PANE, 'pty-1')).toBe(true)

    const slept = server.getStatusSnapshot().find((row) => row.paneKey === PANE)
    expect(slept).toMatchObject({
      paneSleep: { ptyId: 'pty-1' },
      state: 'done',
      interrupted: true,
      sleptPrompt: { interactivePrompt: QUESTION }
    })
    expect(slept?.interactivePrompt).toBeUndefined()
  })
})

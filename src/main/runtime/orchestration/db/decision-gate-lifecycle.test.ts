import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from './orchestration-db'

describe('decision-gate lifecycle transitions', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => db?.close())

  it('keeps the first answer and its source when another resolver arrives', () => {
    db = new OrchestrationDb(':memory:')
    const task = db.createTask({ runId: 'run_legacy_local', spec: 'decision' })
    const gate = db.createGate({ taskId: task.id, question: 'Proceed?' })
    db.resolveGate(gate.id, 'yes', 'user')
    db.updateTaskStatus(task.id, 'blocked')
    expect(() => db!.resolveGate(gate.id, 'no')).toThrow(
      expect.objectContaining({ code: 'already_resolved' })
    )
    expect(db.getGate(gate.id)).toMatchObject({ resolution: 'yes', resolved_by: 'user' })
    expect(db.getTask(task.id)?.status).toBe('blocked')
  })

  it('records coordinator answers and refuses to resolve a timed-out gate', () => {
    db = new OrchestrationDb(':memory:')
    const task = db.createTask({ runId: 'run_legacy_local', spec: 'decision' })
    const gate = db.createGate({ taskId: task.id, question: 'Proceed?' })
    expect(db.resolveGate(gate.id, 'yes')?.resolved_by).toBe('coordinator')
    const next = db.createGate({ taskId: task.id, question: 'Again?' })
    db.timeoutGate(next.id)
    expect(() => db!.resolveGate(next.id, 'late', 'user')).toThrow(
      expect.objectContaining({ code: 'already_resolved' })
    )
    expect(db.getGate(next.id)).toMatchObject({
      status: 'timeout',
      resolution: null,
      resolved_by: null
    })
  })
})

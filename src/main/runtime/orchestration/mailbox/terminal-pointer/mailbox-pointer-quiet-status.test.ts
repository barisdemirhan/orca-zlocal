import { rmSync } from 'node:fs'
import { afterEach, expect, it } from 'vitest'
import { ORCHESTRATION_DELIVERY_BATCH_LIMIT } from '../../db/messages/mailbox-routing-page'
import { selectOrchestrationPointerBatch } from './mailbox-pointer-eligibility'
import {
  createDatabase,
  temporaryDirectories
} from './orchestration-mailbox-notification-test-harness'

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

const filteredWaiter = { typeFilter: ['worker_done', 'escalation', 'question'] }

it('keeps status rows quiet for a filtered waiter, and a full page of them never hides actionable mail', () => {
  const db = createDatabase('orca-quiet-status-')
  try {
    const select = () =>
      selectOrchestrationPointerBatch({
        db,
        mailboxHandle: 'term_coordinator',
        waiters: new Set([filteredWaiter]),
        reservedTypes: undefined
      }).messages.map((message) => message.type)
    const send = (type: 'status' | 'merge_ready') =>
      db.insertMessage({ from: 'term_worker', to: 'term_coordinator', subject: type, type })

    send('status')
    expect(select()).toEqual([])

    for (let i = 1; i < ORCHESTRATION_DELIVERY_BATCH_LIMIT; i += 1) {
      send('status')
    }
    expect(select()).toEqual([])

    send('merge_ready')
    expect(select()).toEqual(['merge_ready'])
  } finally {
    db.close()
  }
})

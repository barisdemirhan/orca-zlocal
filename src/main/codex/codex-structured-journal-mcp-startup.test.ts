import { describe, expect, it } from 'vitest'
import type { AgentJournalItemBody } from '../../shared/agent-session-journal-types'
import type { StructuredAgentSessionEventSink } from '../native-chat/agent-session-wire/structured-agent-session-event-sink'
import { createCodexJournalTranslator } from './codex-structured-journal-translation'

const METHOD = 'mcpServer/startupStatus/updated'
const ERROR = 'The sentry MCP server is not logged in. Run `codex mcp login sentry`.'

function failedStartup(name = 'sentry', threadId = 'thread-1') {
  return { threadId, name, status: 'failed', error: ERROR, failureReason: null }
}

function journal(acquisitionId = 'acquisition-1') {
  const rows: AgentJournalItemBody[] = []
  let rejectAppend = false
  const sink: StructuredAgentSessionEventSink = {
    appendItem: (_identity, body) => rows.push(body),
    tryAppendItem: (_identity, body) => {
      if (rejectAppend) {
        return { accepted: false, reason: 'backpressure' }
      }
      rows.push(body)
      return { accepted: true }
    },
    appendTombstone: () => {},
    publish: () => {}
  }
  const translator = createCodexJournalTranslator({
    sink,
    acquisitionId,
    bindPromptItemId: () => {}
  })
  return {
    rows,
    rejectAppends: (reject: boolean) => {
      rejectAppend = reject
    },
    notify: (params: unknown, threadId = 'thread-1', method = METHOD) =>
      translator.handle({ type: 'notification', sessionId: 'session-1', threadId, method, params })
  }
}

describe('MCP startup failures in a Codex journal acquisition', () => {
  it('journals an identical failure once and keeps a changed diagnostic', () => {
    const tap = journal()
    expect(tap.notify(failedStartup())).toEqual({ accepted: true })
    expect(tap.notify(failedStartup())).toEqual({ accepted: true })
    const changed = { ...failedStartup(), error: 'The sentry MCP server closed its connection.' }
    expect(tap.notify(changed)).toEqual({ accepted: true })

    expect(tap.rows).toEqual([
      expect.objectContaining({ kind: 'status', text: ERROR, tone: 'error' }),
      expect.objectContaining({ kind: 'status', text: changed.error, tone: 'error' })
    ])
  })

  it.each(['starting', 'ready'])('journals the same failure again after %s', (status) => {
    const tap = journal()
    tap.notify(failedStartup())
    tap.notify({ ...failedStartup(), status, error: null })
    tap.notify(failedStartup())

    expect(tap.rows).toHaveLength(2)
    expect(tap.rows.every((row) => row.kind === 'status' && row.text === ERROR)).toBe(true)
  })

  it('keeps server, thread and acquisition health independent', () => {
    const tap = journal()
    tap.notify(failedStartup())
    tap.notify(failedStartup('other'))
    tap.notify(failedStartup('sentry', 'thread-2'), 'thread-2')
    tap.notify({ ...failedStartup('other'), status: 'ready', error: null })
    tap.notify(
      { ...failedStartup('sentry', 'thread-2'), status: 'starting', error: null },
      'thread-2'
    )
    tap.notify(failedStartup())
    expect(tap.rows).toHaveLength(3)

    tap.notify(failedStartup('other'))
    tap.notify(failedStartup('sentry', 'thread-2'), 'thread-2')
    expect(tap.rows).toHaveLength(5)

    const nextAcquisition = journal('acquisition-2')
    nextAcquisition.notify(failedStartup())
    expect(nextAcquisition.rows).toHaveLength(1)
  })

  it('retains a failure retry when the first journal append was backpressured', () => {
    const tap = journal()
    tap.rejectAppends(true)
    expect(tap.notify(failedStartup())).toEqual({ accepted: false, reason: 'backpressure' })
    expect(tap.rows).toEqual([])
    tap.rejectAppends(false)
    expect(tap.notify(failedStartup())).toEqual({ accepted: true })
    expect(tap.notify(failedStartup())).toEqual({ accepted: true })
    expect(tap.rows).toHaveLength(1)
  })

  it('keeps repeated ordinary warnings visible', () => {
    const tap = journal()
    tap.notify({ message: 'Check the configuration' }, 'thread-1', 'warning')
    tap.notify({ message: 'Check the configuration' }, 'thread-1', 'warning')
    expect(tap.rows).toHaveLength(2)
  })
})

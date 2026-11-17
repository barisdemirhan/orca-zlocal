import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { normalizeHookPayload } from './agent-hook-listener/normalization/normalize-hook-payload'
import type { AgentHookEventPayload } from './agent-hook-listener/listener-event'
import {
  createHookListenerState,
  type HookListenerState
} from './agent-hook-listener/listener-state'
import { pollCodexTranscriptStatus } from './agent-hook-listener/providers/codex/codex-transcript-poll'
import { reconcileRemoteCodexState } from './agent-hook-listener/providers/codex/codex-state'
import {
  shouldPollHookTranscript,
  transcriptPollUpdate
} from './agent-hook-listener/transcript-poll-policy'
import { PANE_KEY } from './agent-hook-listener/normalization/agent-hook-listener-test-harness'

describe('Codex approval ownership learned after its hook', () => {
  let state: HookListenerState
  const roots: string[] = []

  beforeEach(() => {
    state = createHookListenerState()
  })

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true })
    }
  })

  function append(path: string, record: unknown): void {
    appendFileSync(path, `${JSON.stringify(record)}\n`)
  }

  function rollout(reviewer?: string): string {
    const root = mkdtempSync(join(tmpdir(), 'codex-approval-poll-'))
    roots.push(root)
    const path = join(root, 'rollout-session.jsonl')
    writeFileSync(path, '')
    append(path, { type: 'turn_context', payload: { approvals_reviewer: reviewer } })
    return path
  }

  function setReviewer(path: string, reviewer: string): void {
    append(path, {
      type: 'event_msg',
      payload: {
        type: 'thread_settings_applied',
        thread_settings: { approvals_reviewer: reviewer }
      }
    })
  }

  function post(payload: Record<string, unknown>): AgentHookEventPayload {
    const event = normalizeHookPayload(state, 'codex', { paneKey: PANE_KEY, payload }, 'production')
    if (!event) {
      throw new Error('Expected a normalized Codex hook')
    }
    return event
  }

  function permission(path: string, agentId?: string, toolName = 'Bash'): AgentHookEventPayload {
    return post({
      hook_event_name: 'PermissionRequest',
      session_id: agentId ?? 'root-session',
      transcript_path: path,
      tool_name: toolName,
      tool_input: { command: 'python3 report.py' },
      ...(agentId ? { agent_id: agentId, agent_type: 'worker' } : {})
    })
  }

  function poll(original: AgentHookEventPayload): AgentHookEventPayload {
    const polled = pollCodexTranscriptStatus(state, original, { paneKey: PANE_KEY }, 'production')
    if (!polled) {
      throw new Error('Expected the Codex transcript poll to retain the pane')
    }
    return polled
  }

  // A child with no parent rollout and nothing owed ends its poll; the last status stays published.
  function pollOrKeep(original: AgentHookEventPayload): AgentHookEventPayload {
    return (
      pollCodexTranscriptStatus(state, original, { paneKey: PANE_KEY }, 'production') ?? original
    )
  }

  it.each([
    ['mcp__calendar__delete_event', undefined, false],
    ['mcp__calendar__delete_event', undefined, true],
    ['mcp__calendar__delete_event', 'child', false],
    ['mcp__calendar__delete_event', 'child', true],
    ['unknown_approval_tool', undefined, false],
    ['unknown_approval_tool', undefined, true]
  ] as const)(
    'preserves per-tool approval ownership for %s, agent=%s, reviewer known=%s',
    (toolName, agentId, knownReviewer) => {
      const path = rollout(knownReviewer ? 'auto_review' : undefined)
      const original = permission(path, agentId, toolName)
      expect(original.payload.state).toBe('waiting')
      if (!knownReviewer) {
        setReviewer(path, 'auto_review')
      }
      const polled = pollOrKeep(original)
      expect(polled.payload.state).toBe('waiting')
      expect(polled.payload.interactivePrompt).toBe(original.payload.interactivePrompt)
      if (agentId) {
        expect(polled.payload.subagents).toEqual([
          expect.objectContaining({ id: agentId, state: 'waiting' })
        ])
      } else {
        expect(polled.payload.interactivePrompt).toContain('python3 report.py')
      }
      expect(transcriptPollUpdate('codex', original, polled)).toBeUndefined()
    }
  )

  it.each([undefined, 'child-only'])(
    'publishes a working approval after its own reviewer becomes automatic, agent=%s',
    (agentId) => {
      const path = rollout()
      const original = permission(path, agentId)
      expect(original.payload.state).toBe('waiting')
      if (!agentId) {
        expect(original.payload.interactivePrompt).toContain('python3 report.py')
      }
      expect(shouldPollHookTranscript(state, 'codex', original)).toBe(true)

      setReviewer(path, 'auto_review')
      const polled = poll(original)
      expect(polled.payload.state).toBe('working')
      expect(polled.payload.interactivePrompt).toBeUndefined()
      if (agentId) {
        expect(polled.payload.subagents).toEqual([
          expect.objectContaining({ id: agentId, state: 'working' })
        ])
      } else {
        expect(polled.payload.mainAgent?.state).toBe('working')
      }
      const update = transcriptPollUpdate('codex', original, polled)
      expect(update).toBeDefined()
      expect(update?.hookEventName).toBeUndefined()
      expect(update?.hasExplicitPrompt).toBeUndefined()
      expect(transcriptPollUpdate('codex', polled, pollOrKeep(polled))).toBeUndefined()
    }
  )

  it.each([
    ['user', undefined],
    ['user', 'child-only'],
    ['unknown-reviewer', undefined],
    ['unknown-reviewer', 'child-only'],
    ['unreadable', undefined],
    ['unreadable', 'child-only']
  ] as const)(
    'keeps the human approval when later reviewer evidence is %s, agent=%s',
    (reviewer, agentId) => {
      const path = rollout()
      const original = permission(path, agentId)
      if (reviewer === 'unreadable') {
        rmSync(path)
      } else {
        setReviewer(path, reviewer)
      }

      const polled = poll(original)
      expect(polled.payload.state).toBe('waiting')
      expect(polled.payload.interactivePrompt).toBe(original.payload.interactivePrompt)
      expect(transcriptPollUpdate('codex', original, polled)).toBeUndefined()
    }
  )

  it.each([undefined, 'child'])(
    'keeps a newer human question when automatic ownership arrives for the previous approval, agent=%s',
    (agentId) => {
      if (agentId) {
        post({ hook_event_name: 'SessionStart', transcript_path: rollout() })
      }
      const path = rollout()
      permission(path, agentId)
      const original = post({
        hook_event_name: 'PreToolUse',
        transcript_path: path,
        tool_name: 'request_user_input',
        tool_input: { questions: [{ id: 'scope', question: 'Which scope should continue?' }] },
        ...(agentId ? { agent_id: agentId } : {})
      })
      setReviewer(path, 'auto_review')

      const polled = agentId ? pollOrKeep(original) : poll(original)
      expect(polled.payload.state).toBe('waiting')
      expect(polled.payload.interactivePrompt).toBe(original.payload.interactivePrompt)
      if (agentId) {
        expect(polled.payload.subagents?.[0]?.state).toBe('waiting')
      }
      expect(transcriptPollUpdate('codex', original, polled)).toBeUndefined()
    }
  )

  it('resolves only the child approval and preserves the manual parent approval', () => {
    const parentPath = rollout('user')
    const parent = permission(parentPath)
    const childPath = rollout()
    const original = permission(childPath, 'child')
    setReviewer(childPath, 'auto_review')

    const polled = poll(original)
    expect(polled.payload.state).toBe('waiting')
    expect(polled.payload.mainAgent?.state).toBe('waiting')
    expect(polled.payload.interactivePrompt).toBe(parent.payload.interactivePrompt)
    expect(polled.payload.subagents).toEqual([
      expect.objectContaining({ id: 'child', state: 'working' })
    ])
    expect(transcriptPollUpdate('codex', original, polled)).toBeDefined()
  })

  it('does not use the parent reviewer to hide a manual child approval', () => {
    const parentPath = rollout('auto_review')
    permission(parentPath)
    const childPath = rollout('user')
    const original = permission(childPath, 'child')
    setReviewer(parentPath, 'auto_review')

    const polled = poll(original)
    expect(polled.payload.state).toBe('waiting')
    expect(polled.payload.subagents).toEqual([
      expect.objectContaining({ id: 'child', state: 'waiting' })
    ])
    expect(transcriptPollUpdate('codex', original, polled)).toBeUndefined()
  })

  it('publishes a newly resolved parent through the relay after a child hook became current', () => {
    const parentPath = rollout()
    const parent = permission(parentPath)
    const childPath = rollout('user')
    const original = permission(childPath, 'child')
    const remote = createHookListenerState()
    const previous = reconcileRemoteCodexState(
      remote,
      PANE_KEY,
      parent.hookEventName,
      parent.toolAgentId,
      parent.payload,
      undefined
    )
    reconcileRemoteCodexState(
      remote,
      PANE_KEY,
      original.hookEventName,
      original.toolAgentId,
      original.payload,
      previous
    )
    setReviewer(parentPath, 'auto_review')

    const update = transcriptPollUpdate('codex', original, poll(original))
    expect(update).toBeDefined()
    if (!update) {
      return
    }
    const relayed = reconcileRemoteCodexState(
      remote,
      PANE_KEY,
      update.hookEventName,
      update.toolAgentId,
      update.payload,
      original.payload
    )
    expect(relayed.mainAgent?.state).toBe('working')
    expect(relayed.state).toBe('waiting')
    expect(relayed.interactivePrompt).toBeUndefined()
    expect(relayed.subagents).toEqual([expect.objectContaining({ id: 'child', state: 'waiting' })])
  })

  it('does not apply an old session reviewer to the replacement session approval', () => {
    const oldPath = rollout()
    permission(oldPath)
    const currentPath = rollout()
    post({
      hook_event_name: 'SessionStart',
      session_id: 'replacement-session',
      transcript_path: currentPath
    })
    const original = permission(currentPath)
    setReviewer(oldPath, 'auto_review')

    const polled = poll(original)
    expect(polled.payload.state).toBe('waiting')
    expect(polled.payload.interactivePrompt).toBe(original.payload.interactivePrompt)
    expect(transcriptPollUpdate('codex', original, polled)).toBeUndefined()
  })
})

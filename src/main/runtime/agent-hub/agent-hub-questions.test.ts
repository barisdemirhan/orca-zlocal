import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentHubGate } from '../../../shared/agent-hub-requests'
import type { AgentQuestionAnsweredInferenceRequest } from '../../../shared/agent-status/lifecycle/agent-question-answered-intent'
import type { AgentStatusIpcPayload } from '../../../shared/agent-status/contracts/agent-status-ipc-payload'
import { hookRowAgentPhase } from '../../../shared/agent-status/lifecycle/agent-transitions'
import { PANE, WORKTREE } from '../../external-conversations/external-conversation.test-fixture'
import { fakeTerminal } from './agent-hub-questions.test-fixture'
import { AgentHubLedger } from './agent-hub-ledger'
import { AgentHubQuestions } from './agent-hub-questions'

const QUESTION = JSON.stringify({
  questions: [
    {
      question: 'Which color?',
      header: 'Color',
      multiSelect: false,
      options: [{ label: 'Red', description: 'warm' }, { label: 'Blue' }]
    }
  ]
})

function row(overrides: Partial<AgentStatusIpcPayload> = {}): AgentStatusIpcPayload {
  return {
    state: 'waiting',
    prompt: '',
    agentType: 'claude',
    paneKey: PANE,
    connectionId: null,
    receivedAt: 1,
    stateStartedAt: 100,
    toolName: 'AskUserQuestion',
    interactivePrompt: QUESTION,
    ...overrides
  }
}

const caller = { paneKey: 'pane-2', terminalHandle: 'term-2', agentType: 'codex', title: 'Worker' }
const ledgers: AgentHubLedger[] = []

afterEach(() => {
  ledgers.splice(0).forEach((ledger) => ledger.dispose())
})

function harness() {
  const hookRows = new Map<string, AgentStatusIpcPayload>([[PANE, row()]])
  const settings: { agentStatusHooksEnabled?: boolean } = {}
  const gates: AgentHubGate[] = []
  const ledger = new AgentHubLedger(
    () => {},
    () => Date.now()
  )
  ledgers.push(ledger)
  ledger.registerDesktop('A')
  const fake = fakeTerminal()
  const typedAt = new Map<string, number>()
  // Mirrors the hook server: only the exact waiting row it was shown is cleared.
  const markQuestionAnswered = vi.fn((request: AgentQuestionAnsweredInferenceRequest) => {
    const current = hookRows.get(request.paneKey)
    if (current?.state !== 'waiting' || current.receivedAt !== request.baselineUpdatedAt) {
      return false
    }
    hookRows.set(
      request.paneKey,
      row({ state: 'working', receivedAt: current.receivedAt + 1, interactivePrompt: undefined })
    )
    return true
  })
  const questions = new AgentHubQuestions({
    readHookRow: (paneKey) => hookRows.get(paneKey) ?? null,
    panesNeedingYou: () =>
      [...hookRows]
        .filter(([, hookRow]) => hookRowAgentPhase(hookRow) === 'needs-you')
        .map(([paneKey]) => ({ paneKey, workspace: { worktreeId: WORKTREE, sshHostId: null } })),
    readSettings: () => settings,
    ledger,
    readGates: () => gates,
    describePane: () => ({ title: 'Fixture agent' }),
    readLastDrivingInputAt: (ptyId) => typedAt.get(ptyId) ?? null,
    markQuestionAnswered
  })
  const list = () => questions.list(fake.terminal)
  const answer = (questionId: string, optionIds: string[], verifyMs = 0) =>
    questions.answer(fake.terminal, questionId, optionIds, verifyMs, new AbortController().signal)
  return { hookRows, settings, gates, ledger, fake, list, answer, typedAt, markQuestionAnswered }
}

describe('AgentHubQuestions agent prompts', () => {
  it('lists a waiting question without a caller pane and answers it once, by its exact id', async () => {
    const { list, answer, fake, hookRows } = harness()
    const [listed] = list()
    expect(listed).toMatchObject({
      source: 'agent-prompt',
      kind: 'question',
      question: 'Which color?',
      header: 'Color',
      options: [
        { id: '1', label: 'Red', description: 'warm' },
        { id: '2', label: 'Blue' }
      ],
      paneKey: PANE,
      terminal: 'term-1',
      worktreeId: WORKTREE,
      agent: 'claude',
      answerable: true
    })

    const answered = answer(listed.questionId, ['2'], 2_000)
    await vi.waitFor(() => expect(fake.keys).toEqual(['2']))
    // Orca's own cleared wait is not evidence; only the agent's next hook is.
    await vi.waitFor(() => expect(hookRows.get(PANE)?.receivedAt).toBe(2))
    hookRows.set(
      PANE,
      row({ state: 'working', receivedAt: 3, stateStartedAt: 300, interactivePrompt: undefined })
    )
    await expect(answered).resolves.toEqual({
      outcome: 'answered',
      questionId: listed.questionId,
      optionIds: ['2'],
      replayed: false,
      evidence: { accepted: true, delivered: true, agentContinued: true }
    })

    // A retry after a lost reply returns the first result; a different choice never lands.
    await expect(answer(listed.questionId, ['2'])).resolves.toMatchObject({ replayed: true })
    await expect(answer(listed.questionId, ['1'])).resolves.toEqual({
      outcome: 'refused',
      questionId: listed.questionId,
      reason: 'already_answered',
      answeredOptionIds: ['2']
    })
    expect(fake.keys).toEqual(['2'])
  })

  it('names why a listed question can no longer be answered, and writes nothing', async () => {
    const restarted = harness()
    const first = restarted.list()[0].questionId
    restarted.fake.replace()
    await expect(restarted.answer(first, ['1'])).resolves.toMatchObject({
      reason: 'process_restarted'
    })

    const changed = harness()
    const before = changed.list()[0].questionId
    changed.hookRows.set(PANE, row({ stateStartedAt: 200 }))
    await expect(changed.answer(before, ['1'])).resolves.toMatchObject({
      reason: 'question_changed'
    })

    const resolved = harness()
    const settled = resolved.list()[0].questionId
    resolved.hookRows.set(PANE, row({ state: 'working', interactivePrompt: undefined }))
    await expect(resolved.answer(settled, ['1'])).resolves.toMatchObject({
      reason: 'question_resolved'
    })

    const gone = harness()
    const closed = gone.list()[0].questionId
    gone.fake.exit()
    await expect(gone.answer(closed, ['1'])).resolves.toMatchObject({ reason: 'terminal_gone' })
    await expect(gone.answer('p_unknown', ['1'])).resolves.toMatchObject({
      reason: 'question_not_found'
    })

    for (const { fake } of [restarted, changed, resolved, gone]) {
      expect(fake.keys).toEqual([])
    }
  })

  it('leaves a question to the person typing in Orca, and claims no evidence it did not see', async () => {
    const typing = harness()
    const [asked] = typing.list()
    typing.typedAt.set('pty-1', 1)
    await expect(typing.answer(asked.questionId, ['1'])).resolves.toMatchObject({
      outcome: 'refused',
      reason: 'answered_in_orca'
    })
    expect(typing.fake.keys).toEqual([])
    expect(typing.markQuestionAnswered).not.toHaveBeenCalled()

    const silent = harness()
    const [quiet] = silent.list()
    silent.typedAt.set('pty-1', 0)
    await expect(silent.answer(quiet.questionId, ['1'], 300)).resolves.toMatchObject({
      outcome: 'answered',
      evidence: { accepted: true, delivered: false, agentContinued: null }
    })
    expect(silent.markQuestionAnswered).toHaveBeenCalledWith({
      paneKey: PANE,
      baselineUpdatedAt: 1,
      baselineStateStartedAt: 100,
      baselinePrompt: '',
      baselineAgentType: 'claude'
    })
  })

  it('shows approvals and prompts it cannot answer as read-only, and refuses to answer them', async () => {
    const approval = harness()
    approval.hookRows.set(
      PANE,
      row({
        toolName: 'Bash',
        interactivePrompt: JSON.stringify({ approval: { tool: 'Bash', summary: 'ls' } })
      })
    )
    const [asked] = approval.list()
    expect(asked).toMatchObject({
      kind: 'approval',
      tool: 'Bash',
      answerable: false,
      reason: 'approval_requires_ui'
    })
    await expect(approval.answer(asked.questionId, ['allow_once'])).resolves.toMatchObject({
      reason: 'approval_requires_ui'
    })

    const hooksOff = harness()
    hooksOff.settings.agentStatusHooksEnabled = false
    const [unreadable] = hooksOff.list()
    expect(unreadable).toMatchObject({
      kind: 'unsupported',
      question: 'Which color?',
      options: [{ label: 'Red' }, { label: 'Blue' }],
      answerable: false,
      reason: 'hooks_disabled'
    })
    await expect(hooksOff.answer(unreadable.questionId, ['1'])).resolves.toMatchObject({
      reason: 'prompt_unsupported'
    })

    expect([...approval.fake.keys, ...hooksOff.fake.keys]).toEqual([])
  })
})

describe('AgentHubQuestions hub asks', () => {
  it('settles an ask for the person, and only one of the CLI and a desktop wins', async () => {
    const { ledger, list, answer, hookRows } = harness()
    hookRows.clear()
    const asked = ledger.ask(
      caller,
      caller,
      { question: 'Ship?', options: ['Yes', 'No', 'Later'], multi: true },
      60_000
    )
    const [listed] = list()
    expect(listed).toMatchObject({
      source: 'hub-ask',
      kind: 'ask',
      question: 'Ship?',
      options: [
        { id: '1', label: 'Yes' },
        { id: '2', label: 'No' },
        { id: '3', label: 'Later' }
      ],
      multi: true,
      answerable: true
    })
    await expect(answer(listed.questionId, ['4'])).resolves.toMatchObject({
      reason: 'option_not_offered'
    })
    await expect(answer(listed.questionId, ['3', '1'])).resolves.toMatchObject({
      outcome: 'answered',
      evidence: { accepted: true, delivered: true, agentContinued: null }
    })
    await expect(asked).resolves.toMatchObject({ by: 'human', answer: 'Yes, Later' })
    expect(() =>
      ledger.respond(listed.questionId, { kind: 'ask', answer: 'No', index: 2 }, 'A')
    ).toThrow(expect.objectContaining({ code: 'already_resolved' }))

    const second = ledger.ask(
      caller,
      caller,
      { question: 'Merge?', options: ['Yes', 'No'], multi: false },
      60_000
    )
    const [other] = list()
    ledger.respond(other.questionId, { kind: 'ask', answer: 'No', index: 2 }, 'A')
    await expect(second).resolves.toMatchObject({ answer: 'No' })
    await expect(answer(other.questionId, ['1'])).resolves.toMatchObject({
      reason: 'question_resolved'
    })

    // An asker whose connection dropped takes the answer only when it resumes.
    const dropped = new AbortController()
    const lost = ledger.ask(
      caller,
      caller,
      { question: 'Tag?', options: ['Yes', 'No'], multi: false },
      60_000,
      'ask-lost',
      dropped.signal
    )
    dropped.abort()
    await expect(lost).rejects.toMatchObject({ code: 'connection_lost' })
    await expect(answer('ask-lost', ['1'])).resolves.toMatchObject({
      evidence: { accepted: true, delivered: false, agentContinued: null }
    })
    await expect(ledger.resume(caller, 'ask-lost')).resolves.toMatchObject({ answer: 'Yes' })
  })

  it('lists a gate with the command that settles it, and does not answer it', async () => {
    const { gates, list, answer, hookRows } = harness()
    hookRows.clear()
    gates.push({
      kind: 'gate',
      requestId: 'gate-1',
      gateId: 'gate-1',
      runId: 'run-1',
      taskId: 'task-1',
      runTitle: 'Release run',
      taskTitle: 'Release',
      question: 'Deploy?',
      options: ['Go', 'Hold'],
      multi: false,
      caller,
      target: caller,
      createdAt: 1,
      expiresAt: 60_000
    })
    const [gate] = list()
    expect(gate).toMatchObject({
      source: 'gate',
      answerable: false,
      reason: 'use_gate_resolve',
      answerVia: 'orca orchestration gate-resolve --id gate-1 --resolution <text>'
    })
    await expect(answer('gate-1', ['1'])).resolves.toMatchObject({ reason: 'not_answerable' })
  })
})

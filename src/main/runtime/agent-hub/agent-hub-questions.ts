import type { PendingPrompt } from '../../../shared/agent-status/contracts/agent-pending-prompt'
import type { AgentHubAnswerResult, AgentHubQuestion } from '../../../shared/agent-hub-questions'
import type { AgentHubGate } from '../../../shared/agent-hub-requests'
import type { AgentQuestionAnsweredInferenceRequest } from '../../../shared/agent-status/lifecycle/agent-question-answered-intent'
import type { AgentStatusHooksSettings } from '../../../shared/agent-hook-listener/configuration/agent-status-hooks-setting'
import type { AgentStatusIpcPayload } from '../../../shared/agent-status/contracts/agent-status-ipc-payload'
import type { ConnectorAgent } from '../../../shared/external-conversation-link'
import { hookRowAgentPhase } from '../../../shared/agent-status/lifecycle/agent-transitions'
import type { AgentPaneWorkspace } from '../../agent-hooks/observations/agent-transition-detector'
import { admitConnectorAgent } from '../../external-conversations/connector-agents'
import type { PromptTerminal } from '../../external-conversations/external-conversation-prompts'
import { createLaunchedAgentWriteGuard } from '../terminal/wait/launched-agent-write-guard'
import {
  TerminalAgentPromptAnswers,
  type PromptAnswerOutcome
} from '../terminal/input/terminal-agent-prompt-answer'
import { watchAnswerEvidence } from './agent-hub-answer-evidence'
import { AgentHubAnswerReceipts, remember } from './agent-hub-answer-receipts'
import type { AgentHubLedger } from './agent-hub-ledger'
import { gateCard, promptCard, requestCard, settleHubAsk } from './agent-hub-question-cards'

export type AgentHubQuestionsDeps = {
  readHookRow: (paneKey: string) => AgentStatusIpcPayload | null
  panesNeedingYou: () => { paneKey: string; workspace: AgentPaneWorkspace }[]
  readSettings: () => AgentStatusHooksSettings
  ledger: Pick<AgentHubLedger, 'snapshot' | 'requests'>
  readGates: () => AgentHubGate[]
  describePane: (paneKey: string, handle: string | null) => { title?: string; agent?: string }
  /** Last keys typed into the pty by a person in Orca or by an answer; null when none. */
  readLastDrivingInputAt: (ptyId: string) => number | null
  /** Clears an answered question's wait at once, as a click in Orca does; false when it cannot. */
  markQuestionAnswered: (request: AgentQuestionAnsweredInferenceRequest) => boolean
}

type PaneQuestion = {
  question: AgentHubQuestion
  prompt: PendingPrompt | null
  paneKey: string
  /** Set only for an agent whose hooks and answer keys are known. */
  writer: ConnectorAgent | null
}
type Binding = { paneKey: string; ptyId: string; processIncarnation: string } | 'hub-ask'

/** Reads every question waiting on this host and answers one, bound to the exact prompt occurrence. */
export class AgentHubQuestions {
  private readonly answers: TerminalAgentPromptAnswers
  // Why: a later answer to a listed prompt can say what happened to it instead of a bare "not found".
  private readonly listed = new Map<string, Binding>()
  private readonly receipts = new AgentHubAnswerReceipts()

  constructor(private readonly deps: AgentHubQuestionsDeps) {
    this.answers = new TerminalAgentPromptAnswers(deps.readHookRow)
  }

  list(terminal: PromptTerminal): AgentHubQuestion[] {
    const panes = this.deps
      .panesNeedingYou()
      .flatMap(({ paneKey, workspace }) => this.readPane(terminal, paneKey, workspace) ?? [])
      .map((pane) => pane.question)
    const requests = this.deps.ledger.snapshot().requests.flatMap((request) => {
      if (request.kind === 'ask') {
        remember(this.listed, request.requestId, 'hub-ask')
      }
      return requestCard(request) ?? []
    })
    const gates = this.deps.readGates().map(gateCard)
    return [...panes, ...requests, ...gates]
  }

  answer(
    terminal: PromptTerminal,
    questionId: string,
    optionIds: string[],
    verifyMs: number,
    signal: AbortSignal
  ): Promise<AgentHubAnswerResult> {
    return this.receipts.once(questionId, optionIds, () =>
      this.answerOnce(terminal, questionId, optionIds, verifyMs, signal)
    )
  }

  private async answerOnce(
    terminal: PromptTerminal,
    questionId: string,
    optionIds: string[],
    verifyMs: number,
    signal: AbortSignal
  ): Promise<AgentHubAnswerResult> {
    const pane = this.findPane(terminal, questionId)
    if (pane) {
      return this.answerPane(terminal, pane, optionIds, verifyMs, signal)
    }
    const request = this.deps.ledger
      .snapshot()
      .requests.find((candidate) => candidate.requestId === questionId)
    if (request) {
      return settleHubAsk(this.deps.ledger.requests, request, optionIds, verifyMs, signal)
    }
    if (this.deps.readGates().some((gate) => gate.gateId === questionId)) {
      return { outcome: 'refused', questionId, reason: 'not_answerable' }
    }
    return { outcome: 'refused', questionId, reason: this.whyGone(terminal, questionId) }
  }

  private async answerPane(
    terminal: PromptTerminal,
    pane: PaneQuestion,
    optionIds: string[],
    verifyMs: number,
    signal: AbortSignal
  ): Promise<AgentHubAnswerResult> {
    const questionId = pane.question.questionId
    const refused = (
      reason: Extract<AgentHubAnswerResult, { outcome: 'refused' }>['reason']
    ): AgentHubAnswerResult => ({ outcome: 'refused', questionId, reason })
    if (pane.prompt?.kind === 'approval') {
      return refused('approval_requires_ui')
    }
    if (pane.prompt?.kind !== 'question') {
      return refused('prompt_unsupported')
    }
    if (optionIds.length !== 1 || !pane.prompt.options.some((o) => o.id === optionIds[0])) {
      return refused('option_not_offered')
    }
    const before = this.deps.readHookRow(pane.paneKey)
    // Keys typed at a shell that replaced the agent would run as a command.
    if (!pane.writer) {
      return refused('prompt_unsupported')
    }
    const guard = createLaunchedAgentWriteGuard(terminal, pane.writer, {
      unprovableHost: 'write-unless-shell'
    })
    let typedInOrca = false
    let written: PromptAnswerOutcome
    try {
      written = await this.answers.answer(
        terminal,
        { paneKey: pane.paneKey, agent: pane.writer, answerable: true },
        {
          promptId: questionId,
          optionId: optionIds[0],
          beforeWrite: async (ptyId) => {
            await guard.beforeWrite(ptyId)
            // Hooks lag the keys: someone typing since the question appeared is answering it in Orca.
            const typedAt = this.deps.readLastDrivingInputAt(ptyId)
            if (before && typedAt !== null && typedAt >= before.receivedAt) {
              typedInOrca = true
              throw new Error('Keys were typed into the terminal after the question appeared')
            }
          },
          signal
        }
      )
    } finally {
      guard.dispose()
    }
    if (written.outcome === 'unknown') {
      return { outcome: 'unknown', questionId }
    }
    if (written.outcome === 'refused') {
      if (typedInOrca) {
        return refused('answered_in_orca')
      }
      return refused(
        written.reason === 'prompt_not_pending'
          ? this.whyGone(terminal, questionId)
          : written.reason
      )
    }
    // Closes the card in every window now, so nobody answers the same question again.
    const marked =
      before !== null &&
      this.deps.markQuestionAnswered({
        paneKey: pane.paneKey,
        baselineUpdatedAt: before.receivedAt,
        baselineStateStartedAt: before.stateStartedAt,
        baselinePrompt: before.prompt,
        baselineAgentType: before.agentType
      })
    return {
      outcome: 'answered',
      questionId,
      optionIds,
      replayed: false,
      evidence: await watchAnswerEvidence(this.deps.readHookRow, pane.paneKey, {
        askedAt: before?.stateStartedAt ?? null,
        markedAt: marked ? (this.deps.readHookRow(pane.paneKey)?.receivedAt ?? null) : null,
        verifyMs,
        signal
      })
    }
  }

  private findPane(terminal: PromptTerminal, questionId: string): PaneQuestion | null {
    for (const { paneKey, workspace } of this.deps.panesNeedingYou()) {
      const pane = this.readPane(terminal, paneKey, workspace)
      if (pane?.question.questionId === questionId) {
        return pane
      }
    }
    return null
  }

  private whyGone(
    terminal: PromptTerminal,
    questionId: string
  ):
    | 'question_not_found'
    | 'question_changed'
    | 'question_resolved'
    | 'terminal_gone'
    | 'process_restarted' {
    const binding = this.listed.get(questionId)
    if (!binding) {
      return 'question_not_found'
    }
    if (binding === 'hub-ask') {
      // Settled by a desktop or expired: either way a person can no longer answer it.
      return 'question_resolved'
    }
    const handle = terminal.getTerminalHandleForPaneKey(binding.paneKey)
    if (!handle) {
      return 'terminal_gone'
    }
    try {
      const now = terminal.getTerminalPromptRequestBinding(handle)
      if (now.ptyId !== binding.ptyId || now.processIncarnation !== binding.processIncarnation) {
        return 'process_restarted'
      }
    } catch {
      return 'terminal_gone'
    }
    const row = this.deps.readHookRow(binding.paneKey)
    return row && hookRowAgentPhase(row) === 'needs-you' ? 'question_changed' : 'question_resolved'
  }

  private readPane(
    terminal: PromptTerminal,
    paneKey: string,
    workspace: AgentPaneWorkspace
  ): PaneQuestion | null {
    const handle = terminal.getTerminalHandleForPaneKey(paneKey)
    if (!handle) {
      return null
    }
    const row = this.deps.readHookRow(paneKey)
    const described = this.deps.describePane(paneKey, handle)
    const agent = row?.agentType ?? described.agent ?? null
    const base = {
      paneKey,
      terminal: handle,
      worktreeId: workspace.worktreeId,
      sshHostId: workspace.sshHostId,
      agent,
      ...(described.title ? { title: described.title } : {}),
      ...(row ? { waitingSince: row.stateStartedAt } : {})
    }
    if (!row || !agent) {
      // A hookless agent's title says it waits, but not on what.
      return {
        question: {
          ...base,
          questionId: `pane:${paneKey}`,
          source: 'agent-prompt',
          kind: 'unsupported',
          options: [],
          answerable: false,
          reason: 'hooks_disabled'
        },
        prompt: null,
        paneKey,
        writer: null
      }
    }
    const writer = admitConnectorAgent(this.deps.readSettings(), agent) ? agent : null
    const answerable = writer !== null
    const prompt = this.answers.pending(terminal, { paneKey, agent, answerable })
    if (!prompt) {
      // Already answered here, or the row moved on since the pane was tracked.
      return null
    }
    try {
      const { ptyId, processIncarnation } = terminal.getTerminalPromptRequestBinding(handle)
      remember(this.listed, prompt.promptId, { paneKey, ptyId, processIncarnation })
    } catch {
      return null
    }
    return {
      question: { ...base, ...promptCard(prompt, row, agent, answerable) },
      prompt,
      paneKey,
      writer
    }
  }
}

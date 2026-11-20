import type { AgentStatusIpcPayload } from '../../../../shared/agent-status/contracts/agent-status-ipc-payload'
import type {
  PendingPrompt,
  PendingPromptOption
} from '../../../../shared/agent-status/contracts/agent-pending-prompt'
import { hookRowAgentPhase } from '../../../../shared/agent-status/lifecycle/agent-transitions'
import { parseAskFromStatus } from '../../../../shared/native-chat/input/native-chat-ask'
import {
  buildAskAnswerKeys,
  buildCodexAskAnswerKeys
} from '../../../../shared/native-chat/input/questions/native-chat-ask-answer'
import { parseNativeChatApprovalEnvelope } from '../../../../shared/native-chat/input/approvals/native-chat-approval-envelope'
import {
  resolveNativeChatTranscriptAgent,
  shouldStepNativeChatAskAnswer
} from '../../../../shared/native-chat/native-chat-agent-support'

type PromptRow = Pick<
  AgentStatusIpcPayload,
  'state' | 'interrupted' | 'mainAgent' | 'interactivePrompt' | 'toolName'
>

/** The row's prompt and the bytes each offered option writes; null while the agent is not waiting. */
export function readAgentPromptAnswers(
  row: PromptRow,
  agent: string,
  promptId: string,
  /** Whether this agent's status hooks and answer keys are known; without them only Orca can answer. */
  answerable: boolean
): { prompt: PendingPrompt; keysByOption: ReadonlyMap<string, string> } | null {
  if (hookRowAgentPhase(row) !== 'needs-you') {
    return null
  }
  const unsupported = {
    prompt: { kind: 'unsupported' as const, promptId },
    keysByOption: new Map()
  }
  if (!answerable || resolveNativeChatTranscriptAgent(agent) === null) {
    return unsupported
  }
  const approval = parseNativeChatApprovalEnvelope(row.interactivePrompt, agent)
  if (approval) {
    return {
      prompt: {
        kind: 'approval',
        promptId,
        tool: approval.tool,
        ...(approval.summary ? { summary: approval.summary } : {}),
        options: [
          { id: 'allow_once', label: 'Allow once' },
          { id: 'reject_once', label: 'Reject' }
        ]
      },
      keysByOption: new Map([
        ['allow_once', approval.allowSend],
        ['reject_once', approval.denySend]
      ])
    }
  }
  const ask = parseAskFromStatus(row.interactivePrompt, row.toolName)
  const question = ask?.questions.length === 1 ? ask.questions[0] : undefined
  if (!ask || !question || question.multiSelect || ask.replyAsMessage) {
    return unsupported
  }
  if (!shouldStepNativeChatAskAnswer(agent)) {
    return unsupported
  }
  const keysByOption = new Map<string, string>()
  const options = question.options.flatMap((option, index): PendingPromptOption[] => {
    const selections = [{ indices: [index] }]
    const groups =
      resolveNativeChatTranscriptAgent(agent) === 'codex'
        ? buildCodexAskAnswerKeys(ask, selections)
        : buildAskAnswerKeys(ask, selections)
    // A pick that takes more than one keystroke needs the paced writer only Orca's views run.
    const only = groups.length === 1 ? groups[0] : undefined
    if (!only || !('raw' in only)) {
      return []
    }
    const id = String(index + 1)
    keysByOption.set(id, only.raw)
    return [
      {
        id,
        label: option.label,
        ...(option.description ? { description: option.description } : {})
      }
    ]
  })
  if (options.length === 0 || options.length !== question.options.length) {
    return unsupported
  }
  return {
    prompt: {
      kind: 'question',
      promptId,
      question: question.question,
      ...(question.header ? { header: question.header } : {}),
      options
    },
    keysByOption
  }
}

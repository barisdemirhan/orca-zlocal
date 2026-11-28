import { translate } from '@/i18n/i18n'
import { sendNotesToActiveAgentSession } from '@/lib/agent-session/messaging/terminal/active-agent-note-send'
import { parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import type {
  AgentSleptPrompt,
  AgentStatusEntry
} from '../../../../shared/agent-status/contracts/agent-status-types'
import type { AskQuestion } from '../../../../shared/native-chat/input/questions/native-chat-ask-types'
import { parseInteractivePrompt } from '../../../../shared/native-chat/input/native-chat-interactive-prompt'
import { sayNativeChatApprovalTranslated } from '../native-chat/prompts/native-chat-interactive-prompt'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { isAgentHubTargetSleeping } from './agent-hub-pane-sleep'
import { wakeAgentHubPane } from './agent-hub-pane-sleep-operations'
import {
  getSleptDelivery,
  setSleptDelivery,
  sleptPromptKey
} from './agent-hub-slept-delivery-store'

/** Main's own tui-idle wait budget for a woken agent. */
const SLEPT_ANSWER_READY_TIMEOUT_MS = 120_000

export type SleptPromptView =
  | { kind: 'question'; questions: AskQuestion[] }
  | { kind: 'permission'; toolName: string | null; detail: string | null }

export function readSleptPrompt(
  prompt: AgentSleptPrompt,
  agentType: string | null | undefined
): SleptPromptView | null {
  const card = parseInteractivePrompt(
    prompt.interactivePrompt,
    prompt.toolName,
    agentType ?? undefined,
    sayNativeChatApprovalTranslated
  )
  if (card?.kind === 'question') {
    return { kind: 'question', questions: card.prompt.questions }
  }
  if (card?.kind === 'approval') {
    return {
      kind: 'permission',
      toolName: card.approval.toolName ?? prompt.toolName ?? null,
      detail: card.approval.detail ?? prompt.toolInput ?? null
    }
  }
  return prompt.toolName
    ? { kind: 'permission', toolName: prompt.toolName, detail: prompt.toolInput ?? null }
    : null
}

/** What a live row is asking, so sleeping it can warn that the question will wait. */
export function askingKindOf(
  entry:
    | Pick<AgentStatusEntry, 'state' | 'interactivePrompt' | 'toolName' | 'agentType'>
    | undefined
): 'question' | 'permission' | null {
  if (!entry || entry.state === 'working' || entry.state === 'done') {
    return null
  }
  if (!entry.interactivePrompt && !entry.toolName) {
    return null
  }
  return (
    readSleptPrompt(
      {
        interactivePrompt: entry.interactivePrompt,
        toolName: entry.toolName,
        savedAt: 0
      },
      entry.agentType
    )?.kind ?? null
  )
}

/** The resumed model reads this as the answer to the question Claude closed on resume. */
export function composeSleptAnswerMessage(questions: readonly string[], answers: string[]): string {
  if (answers.length === questions.length) {
    return questions
      .map((question, index) => `You asked: "${question}"\nMy answer: ${answers[index]}`)
      .join('\n\n')
  }
  return `${questions.map((question) => `You asked: "${question}"`).join('\n')}\nMy answer: ${answers.join('; ')}`
}

export const SLEPT_RETRY_MESSAGE =
  'The tool call you were about to run was interrupted when this session went to sleep. Please retry it.'

/** Wakes the pane if it still sleeps, waits for it to be idle, then sends `message` as ordinary text. */
export async function deliverSleptAnswer(
  target: AgentHubPaneTarget,
  prompt: AgentSleptPrompt,
  message: string
): Promise<void> {
  const paneKey = target.paneKey
  const pane = paneKey ? parsePaneKey(paneKey) : null
  if (!paneKey || !pane) {
    return
  }
  const key = sleptPromptKey(paneKey, prompt)
  const current = getSleptDelivery(key)
  if (current?.phase === 'waking' || current?.phase === 'sending') {
    return
  }
  const record = { paneKey, prompt, message }
  const setDelivery = (phase: 'waking' | 'sending' | 'sent'): void =>
    setSleptDelivery(key, { ...record, phase })
  const fail = (error: string): void => setSleptDelivery(key, { ...record, phase: 'failed', error })
  try {
    if (isAgentHubTargetSleeping(target)) {
      setDelivery('waking')
      await wakeAgentHubPane(target)
    }
    setDelivery('sending')
    const result = await sendNotesToActiveAgentSession({
      worktreeId: target.worktree.id,
      prompt: message,
      noteTarget: { tabId: target.tab.id, leafId: pane.leafId },
      timeoutMs: SLEPT_ANSWER_READY_TIMEOUT_MS,
      waitForIdle: true
    })
    if (result.status === 'sent' || result.status === 'unconfirmed') {
      setDelivery('sent')
    } else {
      fail(translate('agentHub.slept.deliverFailed', "Couldn't deliver yet."))
    }
  } catch (error) {
    fail(
      error instanceof Error
        ? error.message
        : translate('agentHub.slept.deliverFailed', "Couldn't deliver yet.")
    )
  }
}

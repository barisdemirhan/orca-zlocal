import type { RuntimeListingHostScope } from './execution-host/runtime-listing-host-scope'

/** Where a waiting question lives: the agent's own terminal prompt, a hub ask, a gate, or a card only Orca's views settle. */
export type AgentHubQuestionSource = 'agent-prompt' | 'hub-ask' | 'gate' | 'consent' | 'memory'

export type AgentHubQuestionOption = { id: string; label: string; description?: string }

export type AgentHubQuestionUnanswerableReason =
  /** Tool permission is consent; only a person at Orca's own views grants it. */
  | 'approval_requires_ui'
  /** Multi-question, multi-select, free-text, or keystrokes only Orca's paced writer can send. */
  | 'prompt_unsupported'
  /** The agent's status hooks are off or unknown, so its prompt cannot be read. */
  | 'hooks_disabled'
  | 'consent_requires_ui'
  | 'memory_requires_ui'
  | 'use_gate_resolve'
  /** Listed from an older host that cannot read or answer questions. */
  | 'host_unsupported'

export type AgentHubQuestion = {
  /** Host-relative: the agent prompt id is bound to the terminal, its process and this prompt. */
  questionId: string
  source: AgentHubQuestionSource
  kind: 'question' | 'approval' | 'unsupported' | 'ask' | 'gate' | 'consent' | 'memory'
  question?: string
  header?: string
  tool?: string
  options: AgentHubQuestionOption[]
  multi?: boolean
  paneKey: string | null
  terminal: string | null
  worktreeId: string | null
  /** SSH host behind this runtime; null for the runtime's own machine. */
  sshHostId?: string | null
  agent: string | null
  title?: string
  waitingSince?: number
  expiresAt?: number
  answerable: boolean
  reason?: AgentHubQuestionUnanswerableReason
  /** For gates: the command that settles them. */
  answerVia?: string
}

export type AgentHubQuestionsResult = {
  /** Bumped when answer semantics change; callers refuse versions they do not know. */
  questionsVersion: 1
  questions: AgentHubQuestion[]
  /** Hosts this runtime covered; runtime peers are never covered and need their own call. */
  hostScope?: RuntimeListingHostScope
}

export type AgentHubAnswerRefusal =
  | 'question_not_found'
  | 'question_changed'
  | 'question_resolved'
  | 'terminal_gone'
  | 'process_restarted'
  | 'option_not_offered'
  | 'approval_requires_ui'
  | 'prompt_unsupported'
  | 'not_answerable'
  | 'agent_not_reachable'
  | 'already_answered'
  /** Someone typed into the terminal after the question appeared; nothing was written. */
  | 'answered_in_orca'

export type AgentHubAnswerEvidence = {
  /** The host took the answer: keys were written behind the prompt fence, or the hub ask settled. */
  accepted: true
  /** The prompt left the terminal; null when not checked or not applicable. */
  delivered: boolean | null
  /** The agent went back to work; null when not observed in the verify window. */
  agentContinued: boolean | null
}

export type AgentHubAnswerResult =
  | {
      outcome: 'answered'
      questionId: string
      optionIds: string[]
      /** True when this repeats an answer already given with the same options; nothing was written again. */
      replayed: boolean
      evidence: AgentHubAnswerEvidence
    }
  | {
      outcome: 'refused'
      questionId: string
      reason: AgentHubAnswerRefusal
      /** For already_answered: the options the first answer chose. */
      answeredOptionIds?: string[]
    }
  /** The write may or may not have reached the agent; read the questions again before retrying. */
  | { outcome: 'unknown'; questionId: string }

import type { AgentHubOrbAwareness } from './agent-hub-orb-awareness'
import type { AgentHubOrbOperation } from './agent-hub-orb-operation'

export type AgentHubPane = { paneKey: string; terminalHandle: string }
export type AgentHubCaller = AgentHubPane & {
  kind?: 'pane' | 'orb'
  sessionId?: string
  agentType?: string
  title?: string
}

export type AgentHubRequestBase = {
  requestId: string
  caller: AgentHubCaller
  target: AgentHubPane
  createdAt: number
  expiresAt: number
}

export type AgentHubMirrorAction = 'open' | 'add' | 'minimize' | 'restore' | 'close'
export type AgentHubPeekControlAction = 'close' | 'back'
export type AgentHubOperation =
  | { kind: 'peek'; link: string }
  | { kind: 'peek-control'; action: AgentHubPeekControlAction }
  /** `into` names a pane whose card receives an `add`; older desktops ignore it. */
  | { kind: 'mirror'; action: AgentHubMirrorAction; into?: AgentHubPane }
  | { kind: 'arrange'; layout?: string }
  | { kind: 'canvas'; action: 'open' | 'close' }

export type AgentHubAskContent = {
  question: string
  options: string[]
  /** One-based, matching the CLI and answer indices. */
  recommended?: number
  multi: boolean
  ifAway?: 'recommended'
}

export type AgentHubGateContent = {
  kind: 'gate'
  gateId: string
  runId: string
  taskId: string
  runTitle: string
  taskTitle: string
  question: string
  options: string[]
  multi: false
}
export type AgentHubGate = AgentHubRequestBase & AgentHubGateContent

export type AgentHubRequest = AgentHubRequestBase &
  (
    | {
        kind: 'notify'
        text: string
        level: 'info' | 'done' | 'needs-you'
        sound: boolean
        links: string[]
      }
    | ({ kind: 'ask' } & AgentHubAskContent)
    | AgentHubGateContent
    | { kind: 'memory'; text: string }
    | { kind: 'presence' }
    | { kind: 'status' }
    | AgentHubOperation
    | { kind: 'consent'; operation: AgentHubOperation }
  )

export type AgentHubProgress = AgentHubRequestBase & {
  kind: 'progress'
  text: string | null
  /** Optional on the existing event envelope so older clients can keep reading progress. */
  orbOperation?: AgentHubOrbOperation
}
export type AgentHubAnswer = {
  answer: string
  index: number | null
  indices?: number[]
  by: 'human' | 'timeout' | 'away-default'
  desktop: string
}
export type AgentHubPresence = { present: boolean; idleMinutes: number }
export type AgentHubMirrorCard = { parked: boolean; containsCaller: boolean; tabs: AgentHubPane[] }
export type AgentHubStatus = {
  mirrors: AgentHubPane[]
  parked: AgentHubPane[]
  waiting: AgentHubPane[]
  /** Mirrors grouped by card; optional for older desktops. */
  cards?: AgentHubMirrorCard[]
  /** Optional user-selected Orb context; older clients may ignore it. Never grants input authority. */
  orbFocus?: { pinned: AgentHubPane | null; following: AgentHubPane[] }
  /** Current host-sourced status facts. Optional for independently updated peers. */
  orbAwareness?: AgentHubOrbAwareness
  /** What Peek shows for this host, null when closed; older desktops omit it. */
  peek?: AgentHubPeekStatus | null
}
export type AgentHubPeekStatus = { title: string; location: string; canGoBack: boolean }

export type AgentHubMirrorOutcome = 'added' | 'opened' | 'already-there'
/** `nothing-open` also covers a Peek showing another host's page or file. */
export type AgentHubPeekOutcome = 'closed' | 'went-back' | 'nothing-open' | 'at-first-page'
export type AgentHubAck = { mirror?: AgentHubMirrorOutcome; peek?: AgentHubPeekOutcome }
export type AgentHubResponse =
  | ({ kind: 'ack' } & AgentHubAck)
  | ({ kind: 'ask' } & Pick<AgentHubAnswer, 'answer' | 'index' | 'indices'>)
  | ({ kind: 'presence' } & AgentHubPresence)
  | ({ kind: 'status' } & AgentHubStatus)
  | { kind: 'consent'; decision: 'once' | 'session' | 'deny' }
  | { kind: 'memory'; decision: 'remember' | 'decline'; text: string }
  | {
      kind: 'error'
      code: 'disabled_by_user' | 'denied_by_user' | 'invalid_argument'
      message: string
    }

export type AgentHubErrorCode =
  | 'disabled'
  | 'not_found'
  | 'rate_limited'
  | 'no_desktop'
  | 'no_response'
  | 'denied_by_user'
  | 'disabled_by_user'
  | 'timeout'
  | 'already_resolved'
  | 'request_not_found'
  | 'invalid_argument'
  | 'connection_lost'

export type AgentHubClosed = AgentHubRequestBase & {
  kind: 'closed'
  gateId?: string
  reason: 'responded' | AgentHubErrorCode
  result?: AgentHubAnswer
}
export type AgentHubSnapshot = { requests: AgentHubRequest[]; progress: AgentHubProgress[] }
export type AgentHubEvent = AgentHubRequest | AgentHubProgress | AgentHubClosed
export type AgentHubDelivery = AgentHubEvent | { kind: 'snapshot'; snapshot: AgentHubSnapshot }

export type AgentHubRespondResult = { accepted: true; requestId: string }
export type AgentHubRendererApi = {
  subscribe(handler: (event: AgentHubDelivery) => void): () => void
  resolveGate?(gate: AgentHubGate, resolution: string): Promise<void>
  respond(requestId: string, result: AgentHubResponse): Promise<AgentHubRespondResult>
}

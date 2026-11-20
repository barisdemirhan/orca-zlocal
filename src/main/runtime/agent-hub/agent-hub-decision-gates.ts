import { z } from 'zod'
import type {
  AgentHubCaller,
  AgentHubEvent,
  AgentHubGate
} from '../../../shared/agent-hub-requests'
import type { OrchestrationDb } from '../orchestration/db/orchestration-db'
import type { DecisionGateRow } from '../orchestration/db/orchestration-records'

const requesterSchema = z.object({
  assignee_handle: z.string().nullable(),
  assignee_pane_key: z.string().nullable()
})

export function projectAgentHubGate(
  db: OrchestrationDb,
  gate: DecisionGateRow,
  callerFor: (handle: string) => AgentHubCaller | null
): AgentHubGate {
  const task = db.getTask(gate.task_id)
  const run = db.getRun(gate.run_id)
  const dispatch = requesterSchema
    .optional()
    .parse(
      db.db
        .prepare(
          'SELECT assignee_handle, assignee_pane_key FROM dispatch_contexts WHERE task_id = ? ORDER BY rowid DESC LIMIT 1'
        )
        .get(gate.task_id)
    )
  const handle =
    dispatch?.assignee_handle ?? task?.created_by_terminal_handle ?? run?.coordinator_handle ?? ''
  const caller = callerFor(handle) ?? {
    terminalHandle: handle,
    paneKey:
      dispatch?.assignee_pane_key ?? task?.created_by_pane_key ?? run?.coordinator_pane_key ?? ''
  }
  const options = z.array(z.string()).safeParse(JSON.parse(gate.options))
  return {
    kind: 'gate',
    requestId: gate.id,
    gateId: gate.id,
    runId: gate.run_id,
    taskId: gate.task_id,
    runTitle: run?.objective ?? gate.run_id,
    taskTitle: task?.task_title ?? task?.display_name ?? gate.task_id,
    caller,
    target: caller,
    question: gate.question,
    options: options.success ? options.data : [],
    multi: false,
    createdAt: Date.parse(`${gate.created_at.replace(' ', 'T')}Z`),
    expiresAt: Number.MAX_SAFE_INTEGER
  }
}

export function agentHubGateEvent(gate: DecisionGateRow, request: AgentHubGate): AgentHubEvent {
  return gate.status === 'pending'
    ? request
    : {
        ...request,
        kind: 'closed',
        reason: gate.status === 'timeout' ? 'timeout' : 'responded'
      }
}

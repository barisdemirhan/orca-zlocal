import { record, type JsonRecord } from './codex-rollout-jsonl-format'
import { SAFE_THREAD_ID } from './codex-rollout-paths'
import { codexSubagentPathLabel } from './codex-agent-path'

/** A rollout line's subagent activity: started, interacted or interrupted. */
export function readCodexSubagentActivity(recordValue: JsonRecord):
  | {
      id: string
      description?: string
      kind: 'started' | 'interacted' | 'interrupted'
      startedAt: number
      fromItem: boolean
    }
  | undefined {
  if (recordValue.type !== 'event_msg') {
    return undefined
  }
  const payload = record(recordValue.payload)
  // Paginated-history rollouts persist activity only as items.
  const item = payload?.type === 'item_completed' ? record(payload.item) : undefined
  const activity =
    payload?.type === 'sub_agent_activity'
      ? payload
      : item?.type === 'SubAgentActivity'
        ? item
        : undefined
  if (!activity) {
    return undefined
  }
  const id = typeof activity.agent_thread_id === 'string' ? activity.agent_thread_id.trim() : ''
  const rawKind = typeof activity.kind === 'string' ? activity.kind.toLowerCase() : ''
  if (
    !SAFE_THREAD_ID.test(id) ||
    (rawKind !== 'started' && rawKind !== 'interacted' && rawKind !== 'interrupted')
  ) {
    return undefined
  }
  return {
    id,
    description:
      codexSubagentPathLabel(
        typeof activity.agent_path === 'string' ? activity.agent_path : null
      ) ?? undefined,
    kind: rawKind,
    startedAt:
      typeof activity.occurred_at_ms === 'number' && Number.isFinite(activity.occurred_at_ms)
        ? activity.occurred_at_ms
        : Date.now(),
    fromItem: activity === item
  }
}

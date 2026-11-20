import type { GateStatus } from '../orchestration-records'

export type DecisionGateRow = {
  id: string
  run_id: string
  task_id: string
  question: string
  options: string
  status: GateStatus
  resolution: string | null
  resolved_by: 'user' | 'coordinator' | null
  created_at: string
  resolved_at: string | null
}

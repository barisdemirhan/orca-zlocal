import {
  AGENT_MODEL_MAX_LENGTH,
  normalizeOptionalField
} from '../../../../agent-status/contracts/agent-status-field-normalization'
import { parseAgentHookJson } from '../../../request-body'
import { readLastTextFromTranscriptOnce } from '../../../transcript-reader'
import { readClaudeLeadModel } from '../lifecycle/claude-roster-state'

function leadAssistantModelFromLine(line: string): string | undefined {
  const record = parseAgentHookJson(line)
  if (typeof record !== 'object' || record === null) {
    return undefined
  }
  const entry = record as { type?: unknown; isSidechain?: unknown; message?: { model?: unknown } }
  if (entry.type !== 'assistant' || entry.isSidechain === true) {
    return undefined
  }
  const model = entry.message?.model
  return typeof model === 'string' && model !== '<synthetic>' ? model : undefined
}

/** Hooks report the model only at SessionStart; a turn's end reads a mid-session /model switch. */
export function readClaudeLeadEventModel(
  eventName: unknown,
  hookPayload: Record<string, unknown>
): string | undefined {
  const reported = readClaudeLeadModel(hookPayload)
  const transcriptPath = hookPayload.transcript_path
  if (reported || eventName !== 'Stop' || typeof transcriptPath !== 'string' || !transcriptPath) {
    return reported
  }
  return normalizeOptionalField(
    readLastTextFromTranscriptOnce(transcriptPath, leadAssistantModelFromLine),
    AGENT_MODEL_MAX_LENGTH
  )
}

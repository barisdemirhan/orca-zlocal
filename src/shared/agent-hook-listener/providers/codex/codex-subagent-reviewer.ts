import { closeSync, openSync, readSync } from 'node:fs'

import { readJsonlCursor } from './codex-rollout-jsonl-cursor'
import {
  record,
  TRANSCRIPT_READ_MAX_BYTES,
  type JsonlCursor,
  type JsonRecord
} from './codex-rollout-jsonl-format'
import {
  markReviewerEvidenceDeferred,
  rolloutCursorReadDeferred
} from './codex-rollout-prefetch-scope'
import { normalizedTranscriptPath } from './codex-rollout-paths'
import { isCodexStatusTranscriptLine } from './codex-status-transcript-line'
import type { CodexSubagentTranscriptState } from './codex-subagent-transcript'

const REVIEWER_CURSOR_MAX_PATHS = 64
const REVIEWER_LOOKBACK_MAX_BYTES = 8 * 1024 * 1024
const REVIEWER_LOOKBACK_CHUNK_BYTES = 64 * 1024
const REVIEWER_RECORD_MAX_BYTES = 256 * 1024
const TURN_REVIEWED_TOOLS = new Set(['Bash', 'write_stdin', 'apply_patch', 'request_permissions'])
const reviewerCacheByCursor = new WeakMap<
  JsonlCursor,
  { filePath: string | undefined; offset: number; reviewer: CodexApprovalsReviewer | undefined }
>()

/** Codex's `approvals_reviewer`: `user` is a human, `auto_review` is Codex's own review agent. */
export type CodexApprovalsReviewer = 'user' | 'auto_review'

/** MCP actions can override the turn reviewer without changing its saved settings. */
export function codexApprovalUsesTurnReviewer(toolName: string | undefined): boolean {
  return toolName !== undefined && TURN_REVIEWED_TOOLS.has(toolName)
}

/** Latest reviewer evidence from turn or thread-settings records. */
export function readApprovalsReviewer(records: JsonRecord[]): CodexApprovalsReviewer | undefined {
  let reviewer: CodexApprovalsReviewer | undefined
  for (const recordValue of records) {
    const payload = record(recordValue.payload)
    const candidate =
      recordValue.type === 'turn_context'
        ? payload?.approvals_reviewer
        : recordValue.type === 'event_msg' && payload?.type === 'thread_settings_applied'
          ? record(payload.thread_settings)?.approvals_reviewer
          : undefined
    const value = typeof candidate === 'string' ? candidate : ''
    if (value === 'user' || value === 'auto_review') {
      reviewer = value
    } else if (value === 'guardian_subagent') {
      // Codex still accepts this legacy spelling and normalizes it to auto_review.
      reviewer = 'auto_review'
    }
  }
  return reviewer
}

function readPreviousReviewer(
  filePath: string,
  end: number,
  previousOffset: number
): CodexApprovalsReviewer | undefined {
  const floor = Math.max(previousOffset, end - REVIEWER_LOOKBACK_MAX_BYTES)
  // The carried partial line sits after each chunk, so no read concatenates buffers.
  const buffer = Buffer.allocUnsafe(REVIEWER_LOOKBACK_CHUNK_BYTES + REVIEWER_RECORD_MAX_BYTES)
  let suffixLength = 0
  let discardPartialLine = false
  let fd: number | undefined
  const readLine = (line: Buffer): CodexApprovalsReviewer | undefined => {
    if (
      line.length > REVIEWER_RECORD_MAX_BYTES ||
      (!line.includes('"turn_context"') && !line.includes('"thread_settings_applied"'))
    ) {
      return undefined
    }
    try {
      const value: unknown = JSON.parse(line.toString('utf8'))
      const parsed = record(value)
      return parsed ? readApprovalsReviewer([parsed]) : undefined
    } catch {
      return undefined
    }
  }
  try {
    fd = openSync(filePath, 'r')
    while (end > floor) {
      const start = Math.max(floor, end - REVIEWER_LOOKBACK_CHUNK_BYTES)
      const length = end - start
      buffer.copyWithin(length, 0, suffixLength)
      if (readSync(fd, buffer, 0, length, start) !== length) {
        return undefined
      }
      const content = buffer.subarray(0, length + suffixLength)
      let lineEnd = content.length
      for (let newline = content.lastIndexOf(10); newline >= 0;) {
        if (!discardPartialLine) {
          const reviewer = readLine(content.subarray(newline + 1, lineEnd))
          if (reviewer !== undefined) {
            return reviewer
          }
        }
        discardPartialLine = false
        lineEnd = newline
        newline = lineEnd > 0 ? content.lastIndexOf(10, lineEnd - 1) : -1
      }
      if (start === previousOffset && !discardPartialLine) {
        return readLine(content.subarray(0, lineEnd))
      }
      discardPartialLine ||= lineEnd > REVIEWER_RECORD_MAX_BYTES
      suffixLength = discardPartialLine ? 0 : lineEnd
      end = start
    }
  } catch {
    return undefined
  } finally {
    if (fd !== undefined) {
      closeSync(fd)
    }
  }
  return undefined
}

/** Recover policy beyond the lifecycle tail after a cold start or a skipped output burst. */
export function resolveCodexApprovalsReviewer(
  cursor: JsonlCursor,
  previousOffset: number,
  records: JsonRecord[] | undefined,
  previousReviewer: CodexApprovalsReviewer | undefined
): CodexApprovalsReviewer | undefined {
  if (records === undefined) {
    reviewerCacheByCursor.delete(cursor)
    return undefined
  }
  const cached = reviewerCacheByCursor.get(cursor)
  const reset = cursor.offset < previousOffset || (cached && cached.filePath !== cursor.filePath)
  const knownReviewer = reset ? undefined : (previousReviewer ?? cached?.reviewer)
  const offset = cursor.offset - Buffer.byteLength(cursor.carry, 'utf8')
  let reviewer = readApprovalsReviewer(records)
  if (
    reviewer === undefined &&
    cursor.filePath &&
    cursor.offset - previousOffset > TRANSCRIPT_READ_MAX_BYTES
  ) {
    reviewer = readPreviousReviewer(cursor.filePath, offset, reset ? 0 : (cached?.offset ?? 0))
  }
  reviewer ??= knownReviewer
  reviewerCacheByCursor.set(cursor, { filePath: cursor.filePath, offset, reviewer })
  return reviewer
}

/** Whether the transcript's own review agent resolves this permission request. */
export function codexTurnApprovalsAreAutoReviewed(
  state: CodexSubagentTranscriptState | undefined,
  transcriptPath?: string
): boolean {
  const normalizedPath = normalizedTranscriptPath(transcriptPath)
  if (!state || !normalizedPath) {
    return false
  }
  const reviewer =
    normalizedPath === state.parent.filePath
      ? state.approvalsReviewer
      : state.reviewersByPath.get(normalizedPath)
  return reviewer === 'auto_review'
}

/** Reads reviewer ownership from a child rollout without replacing the parent lifecycle cursor. */
export function reconcileCodexSubagentReviewer(
  state: CodexSubagentTranscriptState,
  transcriptPath: string | undefined
): void {
  const normalizedPath = normalizedTranscriptPath(transcriptPath)
  if (!normalizedPath) {
    return
  }
  let cursor = state.reviewerCursorsByPath.get(normalizedPath)
  if (!cursor) {
    if (state.reviewerCursorsByPath.size >= REVIEWER_CURSOR_MAX_PATHS) {
      const oldestPath = state.reviewerCursorsByPath.keys().next().value
      if (typeof oldestPath === 'string') {
        state.reviewerCursorsByPath.delete(oldestPath)
        state.reviewersByPath.delete(oldestPath)
      }
    }
    cursor = { filePath: normalizedPath, offset: 0, carry: '' }
    state.reviewerCursorsByPath.set(normalizedPath, cursor)
  }
  const previousOffset = cursor.offset
  if (rolloutCursorReadDeferred(cursor)) {
    markReviewerEvidenceDeferred()
    return
  }
  const records = readJsonlCursor(cursor, isCodexStatusTranscriptLine)
  if (records === undefined) {
    state.reviewerCursorsByPath.delete(normalizedPath)
    state.reviewersByPath.delete(normalizedPath)
    return
  }
  const reviewer = resolveCodexApprovalsReviewer(
    cursor,
    previousOffset,
    records,
    state.reviewersByPath.get(normalizedPath)
  )
  if (reviewer !== undefined) {
    state.reviewersByPath.set(normalizedPath, reviewer)
  } else {
    state.reviewersByPath.delete(normalizedPath)
  }
}

import type {
  NativeChatBackgroundTaskBlock,
  NativeChatBlock
} from '../../../../../../../shared/native-chat/native-chat-types'

export const COMMAND_OUTPUT_TAIL_LINES = 20

export type WorkerDockCommandDetail = {
  block: NativeChatBackgroundTaskBlock
  command: string | null
  /** The command's printed output; null when the transcript holds none beyond the launch note. */
  output: string | null
}

/** The last lines of `text`, trailing blank lines dropped; `omitted` counts the lines cut off. */
export function lastOutputLines(
  text: string,
  limit = COMMAND_OUTPUT_TAIL_LINES
): { text: string; omitted: number } {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  while (lines.length > 0 && lines.at(-1)!.trim() === '') {
    lines.pop()
  }
  const kept = lines.slice(-limit)
  return { text: kept.join('\n'), omitted: lines.length - kept.length }
}

/** Pairs a task's block with the Bash call that started it and that call's result, from blocks in transcript order. */
export function workerDockCommandDetail(
  blocks: readonly NativeChatBlock[],
  taskId: string
): WorkerDockCommandDetail | null {
  const block = blocks.findLast(
    (candidate): candidate is NativeChatBackgroundTaskBlock =>
      candidate.type === 'background-task' && candidate.taskId === taskId
  )
  if (!block) {
    return null
  }
  const callId = block.parentToolUseId
  let command: string | null = null
  let output: string | null = null
  if (callId) {
    for (const candidate of blocks) {
      if (candidate.type === 'tool-call' && candidate.callId === callId) {
        const input = candidate.input
        const value =
          typeof input === 'object' && input !== null
            ? (input as { command?: unknown }).command
            : null
        command = typeof value === 'string' && value.trim() ? value : null
      } else if (
        candidate.type === 'tool-result' &&
        candidate.callId === callId &&
        candidate.output.trim()
      ) {
        // A background launch answers with where the output goes, not the output itself.
        const launchNote =
          block.outputFile !== undefined && candidate.output.includes(block.outputFile)
        output = launchNote ? null : candidate.output
      }
    }
  }
  return { block, command, output }
}

import { z } from 'zod'
import { encodeBase64Bytes } from '@/lib/base64-bytes'
import { SOURCE } from './worker-dock-seed-fixture'

// Dev-only: a background command whose output is only in a file on the host, as the host answers it.
const OUTPUT_FILE = '/tmp/orca-fixture/tasks/shell-fixture.output'
export const OUTPUT_FILE_LINES = 40
const ChunkRange = z.object({ offset: z.number(), length: z.number() })

const outputFileBytes = (lines: number) =>
  new TextEncoder().encode(
    Array.from(
      { length: lines },
      (_, index) =>
        `[${String(index + 1).padStart(2, '0')}/${lines}] compiled src/renderer/module-${index + 1}.ts\n`
    ).join('')
  )

const historyPage = (state: 'working' | 'done') => ({
  ok: true as const,
  page: {
    sessionId: SOURCE,
    epoch: 'fixture',
    direction: 'tail' as const,
    items: [
      {
        itemId: 'launch',
        revision: 1,
        sequence: 1,
        observedAt: 0,
        body: {
          kind: 'message' as const,
          role: 'assistant' as const,
          blocks: [
            {
              type: 'tool-call' as const,
              name: 'Bash',
              callId: 'call-fixture',
              input: { command: 'pnpm build --watch=false' }
            },
            {
              type: 'background-task' as const,
              taskId: 'shell-fixture',
              kind: 'command' as const,
              label: 'Check the build',
              state,
              parentToolUseId: 'call-fixture',
              outputFile: OUTPUT_FILE,
              startedAt: Date.now() - 90_000
            },
            {
              type: 'tool-result' as const,
              callId: 'call-fixture',
              output: `Command running in background. Output is being written to: ${OUTPUT_FILE}`
            }
          ]
        }
      }
    ],
    removedItemIds: [],
    submissions: [],
    window: {
      oldest: null,
      newest: { epoch: 'fixture', sequence: 1 },
      nextCursor: { epoch: 'fixture', sequence: 1 }
    },
    hasOlder: false,
    hasNewer: false
  }
})

/** The host's answer to the sheet's reads, or undefined for any other call. A running command's
 *  file gains a line at each grant, as a live build's does. */
export function answerCommandOutputFile(
  method: string,
  params: unknown,
  mode: 'done' | 'running',
  file: { lines: number }
): object | undefined {
  if (method === 'agentSession.history') {
    return historyPage(mode === 'running' ? 'working' : 'done')
  }
  if (method === 'files.resolveTerminalPath') {
    if (mode === 'running') {
      file.lines++
    }
    return {
      worktree: 'fixture',
      relativePath: null,
      absolutePath: OUTPUT_FILE,
      exists: true,
      isDirectory: false,
      openTarget: {
        kind: 'absolute-file',
        provider: 'local',
        absolutePath: OUTPUT_FILE,
        grantId: 'grant-fixture',
        byteLength: outputFileBytes(file.lines).length
      }
    }
  }
  if (method === 'files.readTerminalArtifactChunk') {
    const { offset, length } = ChunkRange.parse(params)
    const bytes = outputFileBytes(file.lines).slice(offset, offset + length)
    return { contentBase64: encodeBase64Bytes(bytes), bytesRead: bytes.length, eof: true }
  }
  return undefined
}

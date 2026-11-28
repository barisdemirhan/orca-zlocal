import { useEffect, useState } from 'react'
import { decodeBase64Bytes } from '@/lib/base64-bytes'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { isRenewableGrantError } from '@/runtime/files/grants/runtime-terminal-artifact-grant'
import { toRuntimeWorktreeSelector } from '@/runtime/rpc/targets/runtime-worktree-selector'
import type { RuntimeFileReadChunkResult } from '../../../../../../../shared/file-content/runtime-file-read'
import type { RuntimeClientTarget } from '../../../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type { RuntimeTerminalPathResolution } from '../../../../../../../shared/terminal/runtime-terminal-file-path'

const TAIL_BYTES = 64 * 1024
const POLL_MS = 3000
const RPC_TIMEOUT_MS = 15_000

export type WorkerDockCommandOutputFile = {
  text: string
  /** The read began mid-file, so how many lines came before is unknown. */
  truncated: boolean
}

async function readOutputFileTail(
  target: RuntimeClientTarget,
  worktreeId: string,
  absolutePath: string,
  signal: AbortSignal
): Promise<WorkerDockCommandOutputFile | null> {
  const worktree = toRuntimeWorktreeSelector(worktreeId)
  const resolved = await callRuntimeRpc<RuntimeTerminalPathResolution>(
    target,
    'files.resolveTerminalPath',
    { worktree, pathText: absolutePath },
    { timeoutMs: RPC_TIMEOUT_MS, suppressFeatureInteraction: true, signal }
  )
  const granted = resolved.openTarget
  // Older hosts omit the size, and a binary file has no lines to show.
  if (granted?.kind !== 'absolute-file' || granted.byteLength === undefined || granted.binary) {
    return null
  }
  if (granted.byteLength === 0) {
    return { text: '', truncated: false }
  }
  const offset = Math.max(0, granted.byteLength - TAIL_BYTES)
  const chunk = await callRuntimeRpc<RuntimeFileReadChunkResult>(
    target,
    'files.readTerminalArtifactChunk',
    {
      worktree,
      grantId: granted.grantId,
      absolutePath: granted.absolutePath,
      offset,
      length: granted.byteLength - offset
    },
    { timeoutMs: RPC_TIMEOUT_MS, suppressFeatureInteraction: true, signal }
  )
  let text = new TextDecoder().decode(decodeBase64Bytes(chunk.contentBase64))
  if (offset > 0) {
    // The cut can land inside a line, so the first one is dropped.
    text = text.slice(text.indexOf('\n') + 1 || text.length)
  }
  return { text, truncated: offset > 0 }
}

async function readOutputFileTailRenewing(
  target: RuntimeClientTarget,
  worktreeId: string,
  absolutePath: string,
  signal: AbortSignal
): Promise<WorkerDockCommandOutputFile | null> {
  try {
    return await readOutputFileTail(target, worktreeId, absolutePath, signal)
  } catch (error) {
    if (signal.aborted || !isRenewableGrantError(error)) {
      throw error
    }
    // A growing file outdates its grant between the two calls.
    return readOutputFileTail(target, worktreeId, absolutePath, signal)
  }
}

function waitUnlessAborted(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true }
    )
  })
}

/**
 * The tail of a background command's output file, read on the chat's own host: once when it is
 * settled, about every 3 s while it runs, with a last read when it settles. Undefined until a
 * read succeeds; any failure keeps what was last read.
 */
export function useWorkerDockCommandOutputFile({
  target,
  worktreeId,
  outputFile,
  settled
}: {
  target: RuntimeClientTarget
  worktreeId: string | null | undefined
  /** The path the host itself reported for this task; never one from anywhere else. */
  outputFile: string | undefined
  settled: boolean
}): WorkerDockCommandOutputFile | undefined {
  const [read, setRead] = useState<WorkerDockCommandOutputFile>()
  const absolute = outputFile !== undefined && /^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(outputFile)
  const enabled = Boolean(worktreeId) && absolute
  useEffect(() => {
    if (!enabled || !worktreeId || outputFile === undefined) {
      return
    }
    const controller = new AbortController()
    const { signal } = controller
    void (async () => {
      do {
        // A settled command's one read must not wait for the window to show.
        if (settled || document.visibilityState === 'visible') {
          try {
            const next = await readOutputFileTailRenewing(target, worktreeId, outputFile, signal)
            if (next && !signal.aborted) {
              setRead(next)
            }
          } catch {
            // Any refusal or timeout leaves the sheet's own text.
          }
        }
        if (!settled) {
          await waitUnlessAborted(POLL_MS, signal)
        }
      } while (!settled && !signal.aborted)
    })()
    return () => controller.abort()
  }, [enabled, target, worktreeId, outputFile, settled])
  return enabled ? read : undefined
}

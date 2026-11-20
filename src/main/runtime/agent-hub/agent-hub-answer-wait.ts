import type { AgentHubAnswer } from '../../../shared/agent-hub-requests'

/** A bounded CLI wait detaches its listener; the question keeps its original host deadline. */
export async function waitForAgentHubAnswer(
  requestId: string,
  waitMs: number | undefined,
  signal: AbortSignal | undefined,
  answer: (signal: AbortSignal) => Promise<AgentHubAnswer & { requestId: string }>
): Promise<(AgentHubAnswer & { requestId: string }) | { status: 'pending'; requestId: string }> {
  const controller = new AbortController()
  const onAbort = (): void => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  if (signal?.aborted) {
    onAbort()
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const result = answer(controller.signal)
    if (waitMs === undefined) {
      return await result
    }
    return await Promise.race([
      result,
      new Promise<{ status: 'pending'; requestId: string }>((resolve) => {
        timer = setTimeout(() => resolve({ status: 'pending', requestId }), waitMs)
      })
    ])
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
    controller.abort()
  }
}

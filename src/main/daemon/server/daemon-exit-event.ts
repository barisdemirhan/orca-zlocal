import type { ConnectedDaemonClient } from './daemon-client-connections'
import type { DaemonStreamDataBatcher } from '../transport/stream/daemon-stream-data-batcher'

export function sendDaemonExitEvent(
  batcher: DaemonStreamDataBatcher,
  client: ConnectedDaemonClient | undefined,
  sessionId: string,
  code: number
): void {
  if (!client?.streamSocket) {
    return
  }
  batcher.enqueueControlEvent(client.clientId, sessionId, {
    type: 'event',
    event: 'exit',
    sessionId,
    payload: { code }
  })
  batcher.flush(client.clientId)
}

import { BoundedMap } from '../../shared/bounded-map'

/** One live acquisition's admitted startup failures, independent by thread and server. */
export class CodexMcpStartupFailures {
  private readonly digests = new BoundedMap<string, string>({
    maxEntries: 128,
    maxBytes: 32 * 1024,
    maxEntryBytes: 1024,
    sizeOf: (digest, key) => Buffer.byteLength(digest, 'utf8') + Buffer.byteLength(key, 'utf8')
  })

  observeStatus(kind: string, payload: unknown, threadId: string): string | null {
    if (
      kind !== 'notification:mcpServer/startupStatus/updated' ||
      typeof payload !== 'object' ||
      payload === null ||
      !('name' in payload) ||
      typeof payload.name !== 'string' ||
      !payload.name.trim()
    ) {
      return null
    }
    const key = JSON.stringify([threadId, payload.name])
    if (!('status' in payload) || payload.status !== 'failed') {
      this.digests.delete(key)
      return null
    }
    return key
  }

  isDuplicate(key: string | null, digest: string | undefined): boolean {
    return key !== null && digest !== undefined && this.digests.get(key) === digest
  }

  remember(key: string, digest: string): void {
    this.digests.set(key, digest)
  }

  clear(): void {
    this.digests.clear()
  }
}

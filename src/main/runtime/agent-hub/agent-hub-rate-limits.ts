import { AgentHubError } from './agent-hub-error'
import type { AgentHubCaller } from '../../../shared/agent-hub-requests'

export function agentHubCallerRateKey(caller: AgentHubCaller): string {
  return caller.kind === 'orb' && caller.sessionId ? `orb:${caller.sessionId}` : caller.paneKey
}

type Bucket = 'notify' | 'peek' | 'mirror' | 'query'
const LIMITS = { notify: 6, peek: 6, mirror: 10, query: 30 } as const

export class AgentHubRateLimits {
  private readonly timestamps = new Map<string, number[]>()
  constructor(private readonly now: () => number) {}

  consume(caller: AgentHubCaller, bucket: Bucket): void {
    const now = this.now()
    for (const [key, times] of this.timestamps) {
      const latest = times.at(-1)
      if (latest !== undefined && latest <= now - 60_000) {
        this.timestamps.delete(key)
      }
    }
    const key = JSON.stringify([agentHubCallerRateKey(caller), bucket])
    const times = (this.timestamps.get(key) ?? []).filter((time) => time > now - 60_000)
    if (times.length >= LIMITS[bucket]) {
      throw new AgentHubError('rate_limited', 'Hub rate limit exceeded; retry later', {
        retryAfterMs: times[0] + 60_000 - now
      })
    }
    times.push(now)
    this.timestamps.set(key, times)
  }
}

import { randomUUID } from 'node:crypto'
import type {
  AgentHubCaller,
  AgentHubPane,
  AgentHubProgress
} from '../../../shared/agent-hub-requests'

type ProgressLine = {
  event: AgentHubProgress
  publishedAt: number
  publishTimer?: ReturnType<typeof setTimeout>
  expiryTimer: ReturnType<typeof setTimeout>
}
export class AgentHubProgressLines {
  private readonly lines = new Map<string, ProgressLine>()
  constructor(
    private readonly now: () => number,
    private readonly publish: (event: AgentHubProgress) => void
  ) {}

  update(caller: AgentHubCaller, target: AgentHubPane, text: string | null): void {
    const previous = this.lines.get(target.paneKey)
    if (previous) {
      clearTimeout(previous.expiryTimer)
      if (previous.publishTimer) {
        clearTimeout(previous.publishTimer)
      }
    }
    const now = this.now()
    const event: AgentHubProgress = {
      kind: 'progress',
      requestId: randomUUID(),
      caller,
      target,
      text,
      createdAt: now,
      expiresAt: now + 600_000
    }
    const line: ProgressLine = {
      event,
      publishedAt: previous?.publishedAt ?? -Infinity,
      expiryTimer: setTimeout(() => this.clear(target.paneKey), 600_000)
    }
    line.expiryTimer.unref?.()
    this.lines.set(target.paneKey, line)
    const delay = Math.max(0, line.publishedAt + 1_000 - now)
    if (delay === 0) {
      this.flush(target.paneKey)
    } else {
      line.publishTimer = setTimeout(() => this.flush(target.paneKey), delay)
      line.publishTimer.unref?.()
    }
  }

  snapshot(): AgentHubProgress[] {
    return [...this.lines.values()].map((line) => line.event).filter((event) => event.text !== null)
  }

  dispose(): void {
    for (const line of this.lines.values()) {
      clearTimeout(line.expiryTimer)
      if (line.publishTimer) {
        clearTimeout(line.publishTimer)
      }
    }
    this.lines.clear()
  }

  private flush(paneKey: string): void {
    const line = this.lines.get(paneKey)
    if (!line) {
      return
    }
    line.publishedAt = this.now()
    line.publishTimer = undefined
    this.publish(line.event)
  }

  clear(paneKey: string): void {
    const line = this.lines.get(paneKey)
    if (!line) {
      return
    }
    if (line.event.text !== null) {
      this.update(line.event.caller, line.event.target, null)
      return
    }
    if (line.publishTimer) {
      clearTimeout(line.publishTimer)
    }
    this.lines.delete(paneKey)
  }
}

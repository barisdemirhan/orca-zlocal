import {
  AGENT_HUB_ORB_AWARENESS_INSTRUCTIONS,
  type AgentHubOrbAwareness
} from '../../../../shared/agent-hub-orb-awareness'

type LiveContext = { key: () => string | null; append: (text: string) => Promise<boolean> }
type Update = { context: LiveContext; snapshot: AgentHubOrbAwareness; busy: boolean }

/** One serialized, acknowledged stream per Live attempt. */
export class OrbAwarenessDelivery {
  private update: Update | null = null
  private attempt: string | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private inFlight = false
  private generation = 0
  private lastSentAt = 0
  private lastStates = ''
  private timerDueAt = 0
  private readonly attemptedNotices = new Map<string, string>()
  private readonly contextNotices = new Set<string>()

  constructor(
    private readonly onDelivery: (state: 'idle' | 'delivered' | 'unverifiable') => void
  ) {}

  updateContext(update: Update | null): () => void {
    const attempt = update?.context.key() ?? null
    if (attempt !== this.attempt) {
      this.reset()
      this.attempt = attempt
    }
    this.update = attempt ? update : null
    this.schedule()
    return () => this.pause()
  }

  dispose(): void {
    this.reset()
    this.update = null
    this.attempt = null
  }

  private pause(): void {
    this.update = null
    if (this.timer) {
      clearTimeout(this.timer)
    }
    this.timer = null
  }

  private reset(): void {
    this.generation += 1
    if (this.timer) {
      clearTimeout(this.timer)
    }
    this.timer = null
    this.inFlight = false
    this.lastSentAt = 0
    this.lastStates = ''
    this.attemptedNotices.clear()
    this.contextNotices.clear()
    this.onDelivery('idle')
  }

  private fresh(snapshot: AgentHubOrbAwareness) {
    return snapshot.notices.filter((notice) => this.attemptedNotices.get(notice.id) !== notice.text)
  }

  // Title spinners and `since` churn constantly; only a real state transition is news.
  private states(snapshot: AgentHubOrbAwareness): string {
    return JSON.stringify([
      snapshot.totalAgents,
      snapshot.truncated,
      snapshot.agents.map(({ host, paneKey, agent, state }) => [host, paneKey, agent, state])
    ])
  }

  /** Milliseconds until the next packet may go, or null when there is nothing new. */
  private nextDelay(snapshot: AgentHubOrbAwareness): number | null {
    const elapsed = Date.now() - this.lastSentAt
    const ids = new Set(snapshot.notices.map((notice) => notice.id))
    const removals = [...this.contextNotices].some((id) => !ids.has(id))
    if (!this.lastSentAt || this.fresh(snapshot).length || removals) {
      return Math.max(750, 5_000 - elapsed)
    }
    // Why: every Live append is a turn the model answers aloud, so state-only updates
    // (e.g. an agent finishing) are batched to at most one turn a minute.
    return this.states(snapshot) === this.lastStates ? null : Math.max(750, 60_000 - elapsed)
  }

  private schedule(): void {
    if (!this.update || this.update.busy || this.inFlight) {
      return
    }
    const delay = this.nextDelay(this.update.snapshot)
    if (delay === null || (this.timer && this.timerDueAt <= Date.now() + delay)) {
      return
    }
    if (this.timer) {
      clearTimeout(this.timer)
    }
    this.timerDueAt = Date.now() + delay
    this.timer = setTimeout(() => {
      this.timer = null
      void this.deliver()
    }, delay)
  }

  private async deliver(): Promise<void> {
    const update = this.update
    const attempt = this.attempt
    if (
      !update ||
      update.busy ||
      !attempt ||
      update.context.key() !== attempt ||
      this.nextDelay(update.snapshot) === null
    ) {
      return
    }
    const generation = this.generation
    const snapshot = update.snapshot
    const selected = this.fresh(snapshot).slice(0, 3)
    const currentIds = new Set(snapshot.notices.map((notice) => notice.id))
    const removedNoticeIds = [...this.contextNotices].filter((id) => !currentIds.has(id))
    const packetRemovals: string[] = []
    const packet = {
      scope: 'all Orca agents',
      observedAt: snapshot.observedAt,
      totalAgents: snapshot.totalAgents,
      truncated: snapshot.truncated,
      agents: snapshot.agents.map(({ title, host, paneKey, agent, state }) => ({
        title,
        host,
        paneKey,
        agent,
        state
      })),
      newNotices: selected.map(({ id, title, kind, text }) => ({
        id,
        title,
        kind,
        text: text.slice(0, 1_800)
      })),
      pendingNotices: snapshot.notices.length,
      removedNoticeIds: packetRemovals
    }
    while (packet.agents.length && JSON.stringify(packet).length > 6_000) {
      packet.agents.pop()
      packet.truncated = true
    }
    while (packet.newNotices.length > 1 && JSON.stringify(packet).length > 6_000) {
      packet.newNotices.pop()
      selected.pop()
      packet.truncated = true
    }
    if (JSON.stringify(packet).length > 6_000) {
      packet.newNotices = packet.newNotices.map((notice) => ({
        ...notice,
        text: notice.text.slice(0, 400)
      }))
      packet.truncated = true
    }
    for (const id of removedNoticeIds) {
      packet.removedNoticeIds.push(id)
      if (JSON.stringify(packet).length > 6_000) {
        packet.removedNoticeIds.pop()
        break
      }
    }
    // Drain closures before new questions when both cannot fit in one packet.
    if (removedNoticeIds.length && !packet.removedNoticeIds.length) {
      packet.agents = []
      packet.newNotices = []
      selected.length = 0
      packet.removedNoticeIds = [removedNoticeIds[0]!]
      packet.truncated = true
    }
    // A question can exceed a Live packet; its complete version stays in Hub/CLI.
    const text = AGENT_HUB_ORB_AWARENESS_INSTRUCTIONS + JSON.stringify(packet)
    this.lastSentAt = Date.now()
    // A closure-only drain packet carries no agents, so their states still need a turn.
    if (packet.agents.length || !snapshot.agents.length) {
      this.lastStates = this.states(snapshot)
    }
    selected.forEach((notice) => this.attemptedNotices.set(notice.id, notice.text))
    for (const id of this.attemptedNotices.keys()) {
      if (this.attemptedNotices.size <= 1_024) {
        break
      }
      if (!currentIds.has(id)) {
        this.attemptedNotices.delete(id)
      }
    }
    // An ambiguous append must not replay a closure either.
    packet.removedNoticeIds.forEach((id) => this.contextNotices.delete(id))
    this.inFlight = true
    let applied = false
    try {
      applied = await update.context.append(text)
    } catch {
      // The provider may have accepted an unacknowledged append; never blindly replay it.
    }
    if (generation !== this.generation || update.context.key() !== attempt) {
      return
    }
    this.inFlight = false
    // Even an unacknowledged question may be in the provider context and needs a later closure.
    selected.forEach((notice) => this.contextNotices.add(notice.id))
    this.onDelivery(applied ? 'delivered' : 'unverifiable')
    this.schedule()
  }
}

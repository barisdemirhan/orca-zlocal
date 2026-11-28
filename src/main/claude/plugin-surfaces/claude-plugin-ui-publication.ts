import type { AgentSessionPluginSurfaceUpdate } from '../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'

/** Publishes a surface update only when its serialized value changed. */
export class ClaudePluginUiPublication {
  private readonly published = new Map<string, string>()

  constructor(private readonly publish: (update: AgentSessionPluginSurfaceUpdate) => void) {}

  changed(field: string, value: unknown, update: AgentSessionPluginSurfaceUpdate): void {
    const serialized = JSON.stringify(value)
    if ((this.published.get(field) ?? 'null') === serialized) {
      return
    }
    if (value === null) {
      this.published.delete(field)
    } else {
      this.published.set(field, serialized)
    }
    this.publish(update)
  }

  /** True when something was showing. */
  clear(): boolean {
    const had = this.published.size > 0
    this.published.clear()
    return had
  }
}

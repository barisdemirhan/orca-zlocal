import type {
  AgentSessionPluginStatus,
  AgentSessionPluginSurfaceUpdate
} from '../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'

const MAX_STATUS_LENGTH = 500
const MAX_TOAST_LENGTH = 1000
const MAX_PLUGIN_NAME_LENGTH = 100
const MAX_STATUS_PLUGINS = 20
const DEFAULT_TOAST_MS = 4000

function capped(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/** Status lines and toasts a Claude Code mod raised through `$.ui`; lives as long as one process. */
export class ClaudePluginSurfaces {
  private readonly lines = new Map<string, string>()

  observe(message: Record<string, unknown>): AgentSessionPluginSurfaceUpdate | null {
    if (
      message.type !== 'system' ||
      (message.subtype !== 'ui_status' && message.subtype !== 'ui_toast') ||
      typeof message.plugin !== 'string' ||
      message.plugin.trim() === ''
    ) {
      return null
    }
    const plugin = capped(message.plugin.trim(), MAX_PLUGIN_NAME_LENGTH)
    if (message.subtype === 'ui_status') {
      return this.setLine(plugin, typeof message.text === 'string' ? message.text.trim() : '')
    }
    const text = typeof message.text === 'string' ? message.text.trim() : ''
    if (!text || typeof message.uuid !== 'string') {
      return null
    }
    const timeoutMs =
      typeof message.timeout_ms === 'number' && Number.isFinite(message.timeout_ms)
        ? message.timeout_ms
        : DEFAULT_TOAST_MS
    return {
      toast: {
        id: message.uuid,
        plugin,
        text: capped(text, MAX_TOAST_LENGTH),
        timeoutMs
      }
    }
  }

  /** True when a status was showing, so the caller knows to publish the empty list. */
  clear(): boolean {
    const had = this.lines.size > 0
    this.lines.clear()
    return had
  }

  private setLine(plugin: string, text: string): AgentSessionPluginSurfaceUpdate | null {
    if (!text) {
      return this.lines.delete(plugin) ? { statuses: this.statuses() } : null
    }
    const next = capped(text, MAX_STATUS_LENGTH)
    if (
      this.lines.get(plugin) === next ||
      (!this.lines.has(plugin) && this.lines.size >= MAX_STATUS_PLUGINS)
    ) {
      return null
    }
    this.lines.set(plugin, next)
    return { statuses: this.statuses() }
  }

  private statuses(): AgentSessionPluginStatus[] {
    return [...this.lines].map(([plugin, text]) => ({ plugin, text }))
  }
}

import type {
  AgentSessionPluginClientFaultPhase,
  AgentSessionPluginClientModules
} from '../../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-client-wire'
import {
  PLUGIN_CLIENT_FRAME_NAME_PREFIX,
  PLUGIN_CLIENT_HEARTBEAT_MS,
  buildPluginClientFrameDocument
} from '../../../../../../shared/agent-session/plugin-surfaces/plugin-client-frame-document'

/** A frame silent this long is hung in a loop; the terminal's own limit is a second a call. */
const STUCK_AFTER_MS = PLUGIN_CLIENT_HEARTBEAT_MS * 6
const MAX_POST_CHARS = 100_000
const MAX_TREE_CHARS = 1_000_000

export type PluginClientRuntimeSink = {
  onTree: (id: string, tree: { text: string; key: boolean; pointer: boolean }) => void
  onPost: (id: string, text: string) => void
  onFault: (id: string, phase: AgentSessionPluginClientFaultPhase, reason: string) => void
  /** The instance no longer runs in the frame: it faulted, or the frame is gone. */
  onGone: (id: string) => void
}

export type PluginClientMountRequest = {
  id: string
  entry: string
  component: string
  props: unknown
  columns: number
  rows: number
}

function readFaultPhase(value: unknown): AgentSessionPluginClientFaultPhase {
  return value === 'load' || value === 'render' ? value : 'run'
}

function oneLine(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

/** One isolated frame running one plugin's surface modules; nothing here reaches Orca's window, preload or storage. */
export class PluginClientRuntime {
  private readonly channel: string
  private frame: HTMLIFrameElement | null
  private booted = false
  private readonly outbox: Record<string, unknown>[] = []
  private readonly live = new Set<string>()
  private lastHeardAt = performance.now()
  private watchdog: ReturnType<typeof setInterval> | null
  private readonly onMessage: (event: MessageEvent) => void

  constructor(
    private readonly modules: AgentSessionPluginClientModules,
    private readonly sink: PluginClientRuntimeSink,
    private readonly onDead: () => void
  ) {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    this.channel = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    const frame = document.createElement('iframe')
    frame.name = `${PLUGIN_CLIENT_FRAME_NAME_PREFIX}${this.channel}`
    // Never allow-same-origin: the opaque origin keeps mod code away from Orca's own.
    frame.setAttribute('sandbox', 'allow-scripts')
    frame.setAttribute('aria-hidden', 'true')
    frame.referrerPolicy = 'no-referrer'
    frame.tabIndex = -1
    // In view at one pixel, so Chromium does not throttle a frame it thinks nobody sees.
    frame.style.cssText =
      'position:fixed;left:0;top:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none'
    frame.srcdoc = buildPluginClientFrameDocument(this.channel)
    this.frame = frame
    this.onMessage = (event) => this.receive(event)
    window.addEventListener('message', this.onMessage)
    this.watchdog = setInterval(() => this.checkAlive(), PLUGIN_CLIENT_HEARTBEAT_MS)
    document.body.appendChild(frame)
  }

  mount(request: PluginClientMountRequest): void {
    this.live.add(request.id)
    this.post({ type: 'mount', ...request })
  }

  setProps(id: string, props: unknown): void {
    this.post({ type: 'props', id, props })
  }

  resize(id: string, columns: number, rows: number): void {
    this.post({ type: 'resize', id, columns, rows })
  }

  post(message: Record<string, unknown>): void {
    if (!this.frame) {
      return
    }
    if (this.booted) {
      this.frame.contentWindow?.postMessage({ ...message, channel: this.channel }, '*')
    } else {
      this.outbox.push(message)
    }
  }

  unmount(id: string): void {
    this.live.delete(id)
    this.post({ type: 'unmount', id })
  }

  dispose(): void {
    if (!this.frame) {
      return
    }
    window.removeEventListener('message', this.onMessage)
    if (this.watchdog) {
      clearInterval(this.watchdog)
    }
    this.watchdog = null
    this.frame.remove()
    this.frame = null
    this.outbox.length = 0
  }

  private receive(event: MessageEvent): void {
    const data: unknown = event.data
    if (
      !this.frame ||
      event.source !== this.frame.contentWindow ||
      typeof data !== 'object' ||
      data === null ||
      (data as { channel?: unknown }).channel !== this.channel
    ) {
      return
    }
    this.lastHeardAt = performance.now()
    const message = data as Record<string, unknown>
    const id = typeof message.id === 'string' ? message.id : ''
    switch (message.type) {
      case 'ready':
        this.frame.contentWindow?.postMessage(
          {
            type: 'boot',
            channel: this.channel,
            files: this.modules.files,
            runtime: this.modules.runtime,
            limits: this.modules.limits
          },
          '*'
        )
        break
      case 'booted':
        this.booted = true
        for (const queued of this.outbox.splice(0)) {
          this.post(queued)
        }
        break
      case 'boot-failed':
        this.fail(oneLine(message.reason, 200), 'load')
        break
      case 'tree':
        if (this.live.has(id) && typeof message.text === 'string') {
          if (message.text.length <= MAX_TREE_CHARS) {
            this.sink.onTree(id, {
              text: message.text,
              key: message.key === true,
              pointer: message.pointer === true
            })
          }
        }
        break
      case 'post':
        if (this.live.has(id) && typeof message.text === 'string') {
          if (message.text.length <= MAX_POST_CHARS) {
            this.sink.onPost(id, message.text)
          }
        }
        break
      case 'fault':
        if (this.live.has(id)) {
          this.sink.onFault(id, readFaultPhase(message.phase), oneLine(message.reason, 200))
        }
        break
      case 'gone':
        if (this.live.delete(id)) {
          this.sink.onGone(id)
        }
        break
    }
  }

  private checkAlive(): void {
    if (document.visibilityState !== 'visible') {
      this.lastHeardAt = performance.now()
      return
    }
    if (performance.now() - this.lastHeardAt > STUCK_AFTER_MS) {
      this.fail('a call never returned: the surface stopped answering', 'run')
    }
  }

  /** Kill the frame; every instance in it reports a fault and starts again only when its plugin redraws. */
  private fail(reason: string, phase: AgentSessionPluginClientFaultPhase): void {
    const ids = [...this.live]
    this.live.clear()
    this.dispose()
    for (const id of ids) {
      this.sink.onFault(id, phase, reason)
      this.sink.onGone(id)
    }
    this.onDead()
  }
}

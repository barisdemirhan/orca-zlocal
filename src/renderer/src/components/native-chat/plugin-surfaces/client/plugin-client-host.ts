import type {
  AgentSessionPluginClientAddress,
  AgentSessionPluginClientAnswer,
  AgentSessionPluginClientCall,
  AgentSessionPluginClientEvent,
  AgentSessionPluginClientFaultPhase,
  AgentSessionPluginClientModules
} from '../../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-client-wire'
import type {
  AgentSessionPluginJson,
  AgentSessionPluginNode
} from '../../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import { PluginClientRuntime } from './plugin-client-runtime'
import { readPluginClientTree } from './plugin-client-tree'

export type PluginClientTransport = (
  call: AgentSessionPluginClientCall
) => Promise<AgentSessionPluginClientAnswer>

export type PluginClientView = {
  tree: AgentSessionPluginNode
  wantsKey: boolean
  wantsPointer: boolean
}

export type PluginClientKeyEvent = { key: string; ctrl?: true; shift?: true; meta?: true }

export type PluginClientPointerEvent = {
  type: 'down' | 'move' | 'up' | 'enter' | 'leave'
  x: number
  y: number
  fine?: { x: number; y: number }
  button?: 'left' | 'middle' | 'right'
  shift?: true
  alt?: true
  ctrl?: true
}

export type PluginClientHandle = {
  setProps: (props: unknown) => void
  resize: (columns: number, rows: number) => void
  key: (event: PluginClientKeyEvent) => void
  pointer: (event: PluginClientPointerEvent) => void
  press: (element: string, handle: number, event?: AgentSessionPluginClientEvent) => void
  close: () => void
}

type PluginEntry = {
  hash: string
  disposed: boolean
  modules: AgentSessionPluginClientModules | null
  runtime: Promise<PluginClientRuntime | null>
  instances: Map<string, PluginClientInstance>
}

type InstanceSetup = { props: unknown; columns: number; rows: number }

class PluginClientInstance implements PluginClientHandle {
  readonly id: string
  private entry!: PluginEntry
  private ready: Promise<PluginClientRuntime | null> = Promise.resolve(null)
  private closed = false
  private gone = false
  private props: unknown
  private columns: number
  private rows: number

  constructor(
    private readonly host: PluginClientHost,
    private readonly address: AgentSessionPluginClientAddress,
    private readonly hash: string,
    setup: InstanceSetup,
    private readonly listener: (view: PluginClientView | null) => void
  ) {
    this.id = `${address.component}:${address.instanceId}:${address.client}`
    this.props = setup.props
    this.columns = setup.columns
    this.rows = setup.rows
    this.start()
  }

  private start(): void {
    this.gone = false
    this.entry = this.host.entryFor(this.address.plugin, this.hash)
    const entry = this.entry
    entry.instances.set(this.id, this)
    this.ready = entry.runtime.then((runtime) => {
      if (this.closed || this.gone || entry.disposed) {
        return null
      }
      const spec = entry.modules?.modules.find((one) => one.module === this.address.module)
      if (!runtime || !spec) {
        this.fault(
          'load',
          runtime
            ? `no surface module ${this.address.module}`
            : 'the surface modules could not be fetched'
        )
        return null
      }
      runtime.mount({
        id: this.id,
        entry: spec.entry,
        component: spec.component,
        props: this.props,
        columns: this.columns,
        rows: this.rows
      })
      return runtime
    })
  }

  private with(step: (runtime: PluginClientRuntime) => void): void {
    this.ready = this.ready.then((runtime) => {
      if (runtime && !this.closed && !this.gone) {
        step(runtime)
      }
      return runtime
    })
  }

  setProps(props: unknown): void {
    if (JSON.stringify(props) === JSON.stringify(this.props)) {
      return
    }
    this.props = props
    if (this.gone) {
      this.start()
    } else {
      this.with((runtime) => runtime.setProps(this.id, props))
    }
  }

  resize(columns: number, rows: number): void {
    if (columns === this.columns && rows === this.rows) {
      return
    }
    this.columns = columns
    this.rows = rows
    this.with((runtime) => runtime.resize(this.id, columns, rows))
  }

  key(event: PluginClientKeyEvent): void {
    this.with((runtime) => runtime.post({ type: 'key', id: this.id, event }))
  }

  pointer(event: PluginClientPointerEvent): void {
    this.with((runtime) => runtime.post({ type: 'pointer', id: this.id, event }))
  }

  press(
    element: string,
    handle: number,
    event: AgentSessionPluginClientEvent = { type: 'press' }
  ): void {
    void this.host.call({ kind: 'press', ...this.address, element, event }).then((answer) => {
      if (answer && 'handled' in answer && answer.handled && answer.reached) {
        const reached = answer.reached
        this.with((runtime) => runtime.post({ type: 'held', id: this.id, handle, event: reached }))
      }
    })
  }

  close(): void {
    this.closed = true
    this.entry.instances.delete(this.id)
    void this.ready.then((runtime) => runtime?.unmount(this.id))
  }

  /** From the frame: a fresh drawing, a post for the plugin's hooks, a fault, or the end of this instance. */
  receiveTree(text: string, key: boolean, pointer: boolean): void {
    const tree = readPluginClientTree(
      text,
      this.address.plugin,
      this.entry.modules?.limits.nodes ?? 0
    )
    if (!tree) {
      this.fault('render', 'the module drew a tree the chat cannot draw')
      return
    }
    this.listener({ tree, wantsKey: key, wantsPointer: pointer })
  }

  receivePost(text: string): void {
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      return
    }
    void this.host
      .call({ kind: 'message', ...this.address, data: data as AgentSessionPluginJson })
      .then((answer) => {
        if (answer && 'props' in answer && answer.props !== undefined) {
          const next = answer.props
          this.props = next
          this.with((runtime) => runtime.setProps(this.id, next))
        }
      })
  }

  fault(phase: AgentSessionPluginClientFaultPhase, reason: string): void {
    void this.host.call({ kind: 'fault', ...this.address, phase, reason })
  }

  end(): void {
    this.gone = true
    this.listener(null)
  }
}

/** Runs mods' surface modules for one chat, one isolated frame per plugin and module hash; every engine request goes through `transport`. */
export class PluginClientHost {
  private readonly entries = new Map<string, PluginEntry>()

  constructor(private readonly transport: PluginClientTransport) {}

  call(call: AgentSessionPluginClientCall): Promise<AgentSessionPluginClientAnswer> {
    return this.transport(call).catch(() => null)
  }

  open(
    address: AgentSessionPluginClientAddress,
    hash: string,
    setup: InstanceSetup,
    listener: (view: PluginClientView | null) => void
  ): PluginClientHandle {
    return new PluginClientInstance(this, address, hash, setup, listener)
  }

  /** A hash the engine announced anew replaces the plugin's frame, and every instance in it starts again. */
  entryFor(plugin: string, hash: string): PluginEntry {
    const existing = this.entries.get(plugin)
    if (existing && existing.hash === hash && !existing.disposed) {
      return existing
    }
    if (existing) {
      this.retire(existing)
    }
    const entry: PluginEntry = {
      hash,
      disposed: false,
      modules: null,
      instances: new Map(),
      runtime: Promise.resolve(null)
    }
    this.entries.set(plugin, entry)
    entry.runtime = this.call({ kind: 'module', plugin }).then((answer) => {
      if (entry.disposed || !answer || !('files' in answer)) {
        return null
      }
      entry.modules = answer
      return new PluginClientRuntime(
        answer,
        {
          onTree: (id, tree) =>
            entry.instances.get(id)?.receiveTree(tree.text, tree.key, tree.pointer),
          onPost: (id, text) => entry.instances.get(id)?.receivePost(text),
          onFault: (id, phase, reason) => entry.instances.get(id)?.fault(phase, reason),
          onGone: (id) => entry.instances.get(id)?.end()
        },
        () => {
          entry.disposed = true
          if (this.entries.get(plugin) === entry) {
            this.entries.delete(plugin)
          }
        }
      )
    })
    return entry
  }

  dispose(): void {
    for (const entry of this.entries.values()) {
      this.retire(entry)
    }
    this.entries.clear()
  }

  private retire(entry: PluginEntry): void {
    entry.disposed = true
    void entry.runtime.then((runtime) => runtime?.dispose())
  }
}

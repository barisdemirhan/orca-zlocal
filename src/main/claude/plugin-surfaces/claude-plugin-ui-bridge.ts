import type {
  AgentSessionPluginClientAnswer,
  AgentSessionPluginClientCall
} from '../../../shared/agent-session/plugin-surfaces/agent-session-plugin-client-wire'
import type {
  AgentSessionPluginSurfaceUpdate,
  AgentSessionPluginUiAction,
  AgentSessionPluginUiLayout,
  AgentSessionPluginUiPress
} from '../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import {
  DEFAULT_PLUGIN_UI_LAYOUT,
  isRecord,
  paneWithTabs,
  pluginUiText as text,
  pluginUiViewport,
  readPluginPaneEntry,
  type PluginPaneEntry,
  type PluginUiInstance
} from './claude-plugin-ui-render-site'
import { ClaudePluginUiPublication } from './claude-plugin-ui-publication'
import { pluginUiRenderBody } from './claude-plugin-ui-render-body'
import { clientModulesOf, sendMountedPluginClientCall } from './claude-plugin-ui-client-calls'
import { pluginTreeDrawsContent, sanitizePluginTree } from './claude-plugin-ui-tree'
import {
  pluginUiActionRequest,
  type PluginUiRequestAction
} from './claude-plugin-ui-action-requests'

const SURFACE = 'desktop'

const PROMPT_HINT_INSTANCE = 'prompt-hint'
const ABOVE_PROMPT_INSTANCE = 'above-prompt'
const INVALIDATE_DEBOUNCE_MS = 100
const MAX_PANES = 20

type PluginUiMode = 'idle' | 'attaching' | 'ready' | 'unsupported' | 'closed'

export type ClaudePluginUiBridgeDeps = {
  /** The process's mod-UI control request; absent when this SDK cannot send one. */
  request?: (body: Record<string, unknown>) => Promise<unknown>
  clientId: string
  publish: (update: AgentSessionPluginSurfaceUpdate) => void
  debounceMs?: number
}

/** Draws what mods render through Claude Code's internal `ui_*` protocol; one per process, silent on any failure. */
export class ClaudePluginUiBridge {
  private mode: PluginUiMode = 'idle'
  private panes: PluginPaneEntry[] = []
  private shownPaneId: string | null = null
  private layout: AgentSessionPluginUiLayout = DEFAULT_PLUGIN_UI_LAYOUT
  private readonly mounted = new Map<string, PluginUiInstance>()
  private readonly renderSequence = new Map<string, number>()
  private readonly publication: ClaudePluginUiPublication
  private pendingInstances = new Set<string>()
  private pendingAll = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly clientId: string

  constructor(private readonly deps: ClaudePluginUiBridgeDeps) {
    // Claude Code rejects a client_id outside 1-64 of [A-Za-z0-9._-]; it reserves the colon.
    this.publication = new ClaudePluginUiPublication(deps.publish)
    this.clientId = deps.clientId.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 64) || 'orca'
  }

  /** Attach once the process answers control requests, then draw the prompt hint and any shown pane. */
  start(): void {
    if (this.mode !== 'idle') {
      return
    }
    if (!this.deps.request) {
      this.mode = 'unsupported'
      return
    }
    this.mode = 'attaching'
    void this.attach(this.deps.request)
  }

  observe(message: Record<string, unknown>): void {
    if (message.type !== 'system' || this.mode === 'unsupported' || this.mode === 'closed') {
      return
    }
    if (message.subtype === 'ui_panes') {
      this.readPanes(message)
    } else if (message.subtype === 'ui_invalidate' && this.mode === 'ready') {
      this.invalidate(message)
    }
  }

  act(action: AgentSessionPluginUiAction): Promise<void> {
    if (action.kind === 'press') {
      return this.press(action)
    }
    if (action.kind !== 'layout') {
      return this.request(action)
    }
    const { kind: _kind, ...layout } = action
    if (JSON.stringify(layout) !== JSON.stringify(this.layout)) {
      this.layout = layout
      this.redrawAll()
    }
    return Promise.resolve()
  }

  /** A `Client` region's request: its modules, or a press, post or fault from its frame. */
  callClient(call: AgentSessionPluginClientCall): Promise<AgentSessionPluginClientAnswer> {
    return this.mode === 'ready'
      ? sendMountedPluginClientCall((body) => this.send(body), this.clientId, this.mounted, call)
      : Promise.resolve(null)
  }

  private async request(action: PluginUiRequestAction): Promise<void> {
    const body = pluginUiActionRequest(action, SURFACE, this.clientId, this.panes, this.mounted)
    if (this.mode !== 'ready' || !body) {
      return
    }
    try {
      await this.send(body)
    } catch {
      // Nothing changed; the next ui_panes or redraw shows what is true.
    }
  }

  private async press(press: AgentSessionPluginUiPress): Promise<void> {
    const instance = this.mounted.get(press.instanceId)
    if (this.mode !== 'ready' || !instance || instance.component !== press.component) {
      return
    }
    try {
      const reply = await this.send({
        subtype: 'ui_press',
        plugin: press.plugin,
        handle: press.handle,
        ...(press.key ? { key: press.key } : {}),
        surface: SURFACE,
        client_id: this.clientId,
        render: this.renderBody(instance)
      })
      const drawn = isRecord(reply) && reply.handled === true ? reply.drawn : undefined
      const tree = isRecord(drawn) ? ('tree' in drawn ? drawn.tree : drawn) : undefined
      if (tree === undefined) {
        await this.render(instance)
      } else {
        this.apply(instance, this.nextSequence(instance), tree, clientModulesOf(drawn, reply))
      }
    } catch {
      // The next invalidation redraws; a failed press changes nothing here.
    }
  }

  /** True when something was showing, so the caller knows to publish the cleared trees. */
  clear(): boolean {
    this.mode = 'closed'
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    const had = this.publication.clear()
    this.mounted.clear()
    this.panes = []
    this.shownPaneId = null
    this.pendingInstances.clear()
    return had
  }

  private send(body: Record<string, unknown>): Promise<unknown> {
    return this.deps.request?.(body) ?? Promise.reject(new Error('no request'))
  }

  private renderBody(instance: PluginUiInstance): Record<string, unknown> {
    return pluginUiRenderBody(SURFACE, this.clientId, instance, this.layout, this.panes)
  }

  private async attach(request: NonNullable<ClaudePluginUiBridgeDeps['request']>): Promise<void> {
    try {
      const reply = await request({
        subtype: 'ui_attach',
        surface: SURFACE,
        client_id: this.clientId,
        viewport: pluginUiViewport(this.layout)
      })
      if (!isRecord(reply) || !Array.isArray(reply.surfaces)) {
        throw new Error('unknown ui_attach answer')
      }
    } catch {
      if (this.mode === 'attaching') {
        this.mode = 'unsupported'
      }
      return
    }
    if (this.mode !== 'attaching') {
      return
    }
    this.mode = 'ready'
    this.mount({ component: 'PromptHint', instanceId: PROMPT_HINT_INSTANCE })
    this.mount({ component: 'AbovePrompt', instanceId: ABOVE_PROMPT_INSTANCE })
    this.syncShownPane()
  }

  private readPanes(message: Record<string, unknown>): void {
    const entries = Array.isArray(message.panes) ? message.panes : []
    this.panes = entries.slice(0, MAX_PANES).flatMap((entry) => {
      const pane = readPluginPaneEntry(entry)
      return pane ? [pane] : []
    })
    this.shownPaneId = text(message.shown_id)
    if (this.mode === 'ready') {
      this.syncShownPane()
    }
  }

  private syncShownPane(): void {
    const shown = this.panes.find((pane) => pane.id === this.shownPaneId)
    for (const [id, instance] of this.mounted) {
      if (instance.component === 'Pane' && id !== shown?.id) {
        this.unmount(instance)
        this.publishPane(null)
      }
    }
    if (!shown) {
      this.publishPane(null)
    } else if (!this.mounted.has(shown.id)) {
      this.mount({ component: 'Pane', instanceId: shown.id })
    } else {
      // A renamed pane keeps its drawing but shows the new title.
      void this.render({ component: 'Pane', instanceId: shown.id })
    }
  }

  private mount(instance: PluginUiInstance): void {
    this.mounted.set(instance.instanceId, instance)
    void this.render(instance)
  }

  private unmount(instance: PluginUiInstance): void {
    this.mounted.delete(instance.instanceId)
    this.renderSequence.delete(instance.instanceId)
  }

  private nextSequence(instance: PluginUiInstance): number {
    const next = (this.renderSequence.get(instance.instanceId) ?? 0) + 1
    this.renderSequence.set(instance.instanceId, next)
    return next
  }

  private async render(instance: PluginUiInstance): Promise<void> {
    const sequence = this.nextSequence(instance)
    try {
      const reply = await this.send({ subtype: 'ui_render', ...this.renderBody(instance) })
      this.apply(
        instance,
        sequence,
        isRecord(reply) ? reply.tree : undefined,
        clientModulesOf(reply, reply)
      )
    } catch {
      // A failed draw keeps what is showing.
    }
  }

  private apply(
    instance: PluginUiInstance,
    sequence: number,
    raw: unknown,
    clientModules?: unknown
  ): void {
    if (
      this.mode !== 'ready' ||
      this.renderSequence.get(instance.instanceId) !== sequence ||
      !this.mounted.has(instance.instanceId)
    ) {
      return
    }
    const tree = sanitizePluginTree(raw, clientModules)
    if (instance.component !== 'Pane') {
      const drawn = tree && pluginTreeDrawsContent(tree) ? tree : null
      this.publication.changed(
        instance.component,
        drawn,
        instance.component === 'PromptHint' ? { promptHint: drawn } : { band: drawn }
      )
      return
    }
    const pane = this.panes.find((entry) => entry.id === instance.instanceId)
    this.publishPane(tree && pane ? paneWithTabs(pane, tree, this.panes) : null)
  }

  private publishPane(pane: AgentSessionPluginSurfaceUpdate['pane']): void {
    this.publication.changed('pane', pane, { pane })
  }

  private invalidate(message: Record<string, unknown>): void {
    if (Array.isArray(message.instances)) {
      for (const entry of message.instances) {
        const id = isRecord(entry) && entry.surface === SURFACE ? text(entry.instance_id) : null
        if (id && this.mounted.get(id)?.component === entry.component) {
          this.pendingInstances.add(id)
        }
      }
    } else {
      this.pendingAll = true
    }
    if (this.pendingAll || this.pendingInstances.size > 0) {
      this.schedule()
    }
  }

  private redrawAll(): void {
    if (this.mode !== 'ready') {
      return
    }
    this.pendingAll = true
    this.schedule()
  }

  private schedule(): void {
    this.timer ??= setTimeout(() => this.flush(), this.deps.debounceMs ?? INVALIDATE_DEBOUNCE_MS)
    this.timer.unref?.()
  }

  private flush(): void {
    this.timer = null
    if (this.mode !== 'ready') {
      return
    }
    const instances = this.pendingAll ? [...this.mounted.keys()] : [...this.pendingInstances]
    this.pendingAll = false
    this.pendingInstances.clear()
    for (const id of instances) {
      const instance = this.mounted.get(id)
      if (instance) {
        void this.render(instance)
      }
    }
  }
}

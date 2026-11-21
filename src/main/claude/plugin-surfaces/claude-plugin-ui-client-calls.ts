import type {
  AgentSessionPluginClientAddress,
  AgentSessionPluginClientAnswer,
  AgentSessionPluginClientCall,
  AgentSessionPluginClientModules
} from '../../../shared/agent-session/plugin-surfaces/agent-session-plugin-client-wire'
import type { AgentSessionPluginJson } from '../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import { isRecord } from './claude-plugin-ui-render-site'

export type PluginClientSend = (body: Record<string, unknown>) => Promise<unknown>

/** The plugin-to-hash map a render announced, on the drawn part of a press answer or on the answer itself. */
export function clientModulesOf(drawn: unknown, reply: unknown): unknown {
  const own = isRecord(drawn) ? drawn.client_modules : undefined
  return own ?? (isRecord(reply) ? reply.client_modules : undefined)
}

function flatAddress(address: AgentSessionPluginClientAddress): Record<string, unknown> {
  return {
    plugin: address.plugin,
    component: address.component,
    instance_id: address.instanceId,
    client: address.client,
    module: address.module
  }
}

function readModules(reply: unknown): AgentSessionPluginClientModules | null {
  if (
    !isRecord(reply) ||
    typeof reply.plugin !== 'string' ||
    typeof reply.hash !== 'string' ||
    typeof reply.runtime !== 'string' ||
    !Array.isArray(reply.modules) ||
    !Array.isArray(reply.files) ||
    !isRecord(reply.limits)
  ) {
    return null
  }
  const { nodes, depth, chars, values, dataDepth } = reply.limits
  if (![nodes, depth, chars, values, dataDepth].every((limit) => typeof limit === 'number')) {
    return null
  }
  return {
    plugin: reply.plugin,
    hash: reply.hash,
    runtime: reply.runtime,
    limits: reply.limits as AgentSessionPluginClientModules['limits'],
    modules: reply.modules.flatMap((entry) =>
      isRecord(entry) &&
      typeof entry.module === 'string' &&
      typeof entry.entry === 'string' &&
      typeof entry.component === 'string'
        ? [{ module: entry.module, entry: entry.entry, component: entry.component }]
        : []
    ),
    files: reply.files.flatMap((file) =>
      isRecord(file) && typeof file.key === 'string' && typeof file.source === 'string'
        ? [{ key: file.key, source: file.source }]
        : []
    )
  }
}

/** Asks the engine for a `Client`'s modules, or reports what a frame did there; answers only what the chat reads. */
export async function sendPluginClientCall(
  send: PluginClientSend,
  clientId: string,
  call: AgentSessionPluginClientCall
): Promise<AgentSessionPluginClientAnswer> {
  if (call.kind === 'module') {
    return readModules(await send({ subtype: 'ui_client_module', plugin: call.plugin }))
  }
  const address = flatAddress(call)
  if (call.kind === 'press') {
    const reply = await send({
      subtype: 'ui_client_press',
      ...address,
      surface: 'desktop',
      client_id: clientId,
      element: call.element,
      event: call.event
    })
    if (!isRecord(reply)) {
      return null
    }
    return {
      handled: reply.handled === true,
      ...(isRecord(reply.reached)
        ? { reached: reply.reached as Record<string, AgentSessionPluginJson> }
        : {})
    }
  }
  if (call.kind === 'message') {
    const reply = await send({
      subtype: 'ui_message',
      ...address,
      surface: 'desktop',
      client_id: clientId,
      data: call.data
    })
    return isRecord(reply) && 'props' in reply
      ? { props: reply.props as AgentSessionPluginJson }
      : {}
  }
  const reply = await send({
    subtype: 'ui_client_fault',
    ...address,
    client_id: clientId,
    phase: call.phase,
    reason: call.reason
  })
  return { handled: isRecord(reply) && reply.handled === true }
}

/** Sends a call unless it names an instance that is no longer mounted as that component. */
export function sendMountedPluginClientCall(
  send: PluginClientSend,
  clientId: string,
  mounted: ReadonlyMap<string, { component: string }>,
  call: AgentSessionPluginClientCall
): Promise<AgentSessionPluginClientAnswer> {
  const stale = call.kind !== 'module' && mounted.get(call.instanceId)?.component !== call.component
  return stale ? Promise.resolve(null) : sendPluginClientCall(send, clientId, call)
}

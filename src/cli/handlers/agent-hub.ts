import type { CommandHandler, HandlerContext } from '../dispatch'
import { getOptionalStringFlag, getRepeatedStringFlag } from '../flags'
import {
  AgentHubNotifyParams,
  AgentHubPeekParams,
  AgentHubProgressParams,
  AgentHubPresenceParams,
  AgentHubStatusParams,
  AgentHubMirrorParams,
  AgentHubArrangeParams,
  AgentHubCanvasParams
} from '../../shared/rpc-contract/agent-hub-params'
import { agentHubCallerFlags, parseAgentHubParams, printAgentHubCommand } from './agent-hub-command'
import { agentHubAsk } from './agent-hub-ask'

function operation(
  method: string,
  schema: { parse(value: unknown): unknown },
  content: (ctx: HandlerContext) => Record<string, unknown>
): CommandHandler {
  return async (ctx) =>
    printAgentHubCommand(
      ctx,
      method,
      parseAgentHubParams(schema, { ...agentHubCallerFlags(ctx.flags), ...content(ctx) })
    )
}

export const AGENT_HUB_HANDLERS: Record<string, CommandHandler> = {
  'hub ask': agentHubAsk,
  'hub notify': operation('agentHub.notify', AgentHubNotifyParams, ({ flags }) => ({
    text: getOptionalStringFlag(flags, 'text'),
    level: getOptionalStringFlag(flags, 'level'),
    sound: flags.get('sound') === true,
    links: getRepeatedStringFlag(flags, 'link')
  })),
  'hub peek': operation('agentHub.peek', AgentHubPeekParams, ({ flags }) => ({
    link: getOptionalStringFlag(flags, 'link')
  })),
  'hub progress': operation('agentHub.progress', AgentHubProgressParams, ({ flags }) => ({
    text: getOptionalStringFlag(flags, 'text'),
    clear: flags.get('clear') === true
  })),
  'hub presence': operation('agentHub.presence', AgentHubPresenceParams, () => ({})),
  'hub status': operation('agentHub.status', AgentHubStatusParams, () => ({})),
  'hub arrange': operation('agentHub.arrange', AgentHubArrangeParams, ({ flags }) => ({
    layout: getOptionalStringFlag(flags, 'layout')
  })),
  ...Object.fromEntries(
    ['open', 'add', 'minimize', 'restore', 'close'].map((action) => [
      `hub mirror ${action}`,
      operation('agentHub.mirror', AgentHubMirrorParams, () => ({ action }))
    ])
  ),
  ...Object.fromEntries(
    ['open', 'close'].map((action) => [
      `hub canvas ${action}`,
      operation('agentHub.canvas', AgentHubCanvasParams, () => ({ action }))
    ])
  )
}

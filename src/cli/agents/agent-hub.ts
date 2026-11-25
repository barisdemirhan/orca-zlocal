import { homedir } from 'node:os'
import { resolve } from 'node:path'
import type { CommandHandler, HandlerContext } from '../dispatch/dispatch'
import { getOptionalStringFlag, getRepeatedStringFlag } from '../arguments/flags'
import {
  AgentHubNotifyParams,
  AgentHubPeekParams,
  AgentHubPeekControlParams,
  AgentHubProgressParams,
  AgentHubPresenceParams,
  AgentHubStatusParams,
  AgentHubMirrorParams,
  AgentHubCardParams,
  AgentHubArrangeParams,
  AgentHubCanvasParams,
  AgentHubOrbRememberParams
} from '../../shared/rpc-contract/agent-hub-params'
import { agentHubCallerFlags, parseAgentHubParams, printAgentHubCommand } from './agent-hub-command'
import { agentHubAsk } from './agent-hub-ask'
import { RuntimeClientError } from '../runtime/connection/types'

function agentHubPeekLink({ flags, cwd }: HandlerContext): string {
  const link = getOptionalStringFlag(flags, 'link')
  if (!link) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Missing <url|path>. Usage: orca hub peek <url|path>'
    )
  }
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(link)) {
    return link
  }
  if (link === '~' || /^~[/\\]/.test(link)) {
    return resolve(homedir(), link.slice(2))
  }
  // Why: the agent's current directory can differ from the pane's startup directory.
  return resolve(cwd, link)
}

function agentHubCardSince(raw: string | undefined): 'last' | number {
  if (raw === 'last' || raw === undefined) {
    return 'last'
  }
  if (!/^\d+$/.test(raw)) {
    throw new RuntimeClientError('invalid_argument', '--since takes last or a sequence number')
  }
  return Number(raw)
}

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
  'hub peek': operation('agentHub.peek', AgentHubPeekParams, (ctx) => ({
    link: agentHubPeekLink(ctx)
  })),
  ...Object.fromEntries(
    ['close', 'back'].map((action) => [
      `hub peek ${action}`,
      operation('agentHub.peekControl', AgentHubPeekControlParams, () => ({ action }))
    ])
  ),
  'hub progress': operation('agentHub.progress', AgentHubProgressParams, ({ flags }) => ({
    text: getOptionalStringFlag(flags, 'text'),
    clear: flags.get('clear') === true
  })),
  'hub orb remember': operation(
    'agentHub.orb.remember',
    AgentHubOrbRememberParams,
    ({ flags }) => ({
      text: getOptionalStringFlag(flags, 'text')
    })
  ),
  'hub presence': operation('agentHub.presence', AgentHubPresenceParams, () => ({})),
  'hub status': operation('agentHub.status', AgentHubStatusParams, () => ({})),
  'hub arrange': operation('agentHub.arrange', AgentHubArrangeParams, ({ flags }) => ({
    layout: getOptionalStringFlag(flags, 'layout')
  })),
  ...Object.fromEntries(
    ['open', 'add', 'minimize', 'restore', 'close'].map((action) => [
      `hub mirror ${action}`,
      operation('agentHub.mirror', AgentHubMirrorParams, ({ flags }) => ({
        action,
        into: getOptionalStringFlag(flags, 'into')
      }))
    ])
  ),
  'hub mirror list': operation('agentHub.card', AgentHubCardParams, () => ({
    action: 'list',
    terminal: undefined
  })),
  'hub mirror show': operation('agentHub.card', AgentHubCardParams, ({ flags }) => ({
    action: 'show',
    terminal: undefined,
    drawer: getOptionalStringFlag(flags, 'drawer'),
    mirrorId: getOptionalStringFlag(flags, 'mirror')
  })),
  'hub mirror events': operation('agentHub.card', AgentHubCardParams, ({ flags }) => ({
    action: 'events',
    terminal: undefined,
    since: agentHubCardSince(getOptionalStringFlag(flags, 'since'))
  })),
  ...Object.fromEntries(
    ['open', 'close'].map((action) => [
      `hub canvas ${action}`,
      operation('agentHub.canvas', AgentHubCanvasParams, () => ({ action }))
    ])
  )
}

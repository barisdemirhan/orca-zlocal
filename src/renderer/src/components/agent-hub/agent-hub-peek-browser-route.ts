import { useAppStore } from '@/store'
import { getClientCreationActionPolicy } from '@/lib/client-creation-action-policy'
import {
  resolveWorktreeOperationRoute,
  resolveWorktreeOperationRouteForHost
} from '@/lib/worktree-operation-route'
import { browserUrlForPortForwardEntry } from '@/lib/workspace-port-urls'
import { resolveSshWorkspaceBrowserRouteEligibility } from '@/lib/ssh-workspace-browser-route-eligibility'
import {
  parseExecutionHostId,
  toRuntimeExecutionHostId,
  toSshExecutionHostId
} from '../../../../shared/execution-host'
import { classifyRemotePairingHostname } from '../../../../shared/remote-pairing-address'
import { getRuntimeSshAccess } from '../../../../shared/runtime-environments'
import { AGENT_HUB_PEEK_WORKTREE_ID } from '../../../../shared/agent-hub-peek-workspace'
import type { AgentHubPeekLinkSource } from './agent-hub-peek-routing'
import type { AgentHubPeekContent } from './agent-hub-peek-store'

export function agentHubPeekSourceRoute(source: AgentHubPeekLinkSource) {
  const state = useAppStore.getState()
  if (source.sourceOwner?.kind === 'unknown') {
    return null
  }
  const workspaceRoute = resolveWorktreeOperationRoute(state, source.worktreeId)
  // WHY: a paired HUB can proxy an SSH workspace; its transport id is not the target host.
  if (
    source.sourceOwner?.kind === 'runtime' &&
    workspaceRoute?.runtimeEnvironmentId === source.sourceOwner.runtimeEnvironmentId
  ) {
    return workspaceRoute
  }
  const hostId =
    source.sourceOwner?.kind === 'runtime'
      ? toRuntimeExecutionHostId(source.sourceOwner.runtimeEnvironmentId)
      : source.sourceOwner?.kind === 'ssh'
        ? toSshExecutionHostId(source.sourceOwner.connectionId)
        : source.sourceOwner?.kind === 'local'
          ? 'local'
          : null
  return hostId
    ? resolveWorktreeOperationRouteForHost(state, source.worktreeId, hostId)
    : workspaceRoute
}

function isHostOnlyAddress(hostname: string): boolean {
  const host = hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase()
  return classifyRemotePairingHostname(host) === 'loopback' || host === '0.0.0.0' || host === '::'
}

const PRIVATE_NAME_SUFFIXES = [
  '.test',
  '.local',
  '.internal',
  '.lan',
  '.home.arpa',
  '.example',
  '.invalid'
]

/** A name or address only its own network resolves; this machine may reach something else. */
function isPrivateNetworkHost(hostname: string): boolean {
  const host = hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase()
  return (
    classifyRemotePairingHostname(host) !== 'public' ||
    host.startsWith('169.254.') ||
    PRIVATE_NAME_SUFFIXES.some((suffix) => host.endsWith(suffix))
  )
}

export function isAgentHubPeekHostAddress(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return isHostOnlyAddress(hostname) || isPrivateNetworkHost(hostname)
  } catch {
    return false
  }
}

export function agentHubPeekBrowserRoute(
  url: string,
  source: AgentHubPeekLinkSource
): Extract<AgentHubPeekContent, { kind: 'web' }> | null {
  const state = useAppStore.getState()
  if (
    getClientCreationActionPolicy(state, AGENT_HUB_PEEK_WORKTREE_ID)['managed-browser'].state !==
    'enabled'
  ) {
    return null
  }
  const route = agentHubPeekSourceRoute(source)
  const host = parseExecutionHostId(route?.executionHostId)
  if (!route || !host) {
    return null
  }
  if (!route.runtimeEnvironmentId) {
    return {
      kind: 'web',
      url,
      hostId: host.id,
      ...(host.kind === 'ssh' ? { routingWorktreeId: source.worktreeId } : {})
    }
  }
  // WHY: an SSH-deployed server's pages leave over its SSH route, as its workspace browser's do.
  if (
    resolveSshWorkspaceBrowserRouteEligibility(
      route.executionHostId,
      state.settings,
      state.runtimeEnvironments
    )?.eligible
  ) {
    return {
      kind: 'web',
      url,
      hostId: 'local',
      routeHostId: host.id,
      routingWorktreeId: source.worktreeId
    }
  }
  const parsed = new URL(url)
  if (!isHostOnlyAddress(parsed.hostname)) {
    // WHY: the runtime's workspace browser resolves a private name on that host; here it may not.
    return isPrivateNetworkHost(parsed.hostname) ? null : { kind: 'web', url, hostId: 'local' }
  }
  const environment = state.runtimeEnvironments?.find(
    (entry) => entry.id === route.runtimeEnvironmentId
  )
  const targetId =
    host.kind === 'ssh'
      ? host.targetId
      : environment
        ? getRuntimeSshAccess(environment)?.sshTargetId
        : undefined
  const port = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80))
  const forward = targetId
    ? state.portForwardsByConnection[targetId]?.find(
        (entry) => entry.remotePort === port && isHostOnlyAddress(entry.remoteHost)
      )
    : undefined
  if (!forward) {
    return null
  }
  // WHY: the Ports panel owns the forward origin; preserve the clicked path, query and fragment.
  const forwarded = new URL(browserUrlForPortForwardEntry(forward))
  parsed.hostname = forwarded.hostname
  parsed.port = forwarded.port
  return { kind: 'web', url: parsed.toString(), hostId: 'local' }
}

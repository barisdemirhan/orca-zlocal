import { useCallback, useSyncExternalStore } from 'react'
import { returnRetainedPaneDestinationHome } from '../../tab-group/retained-pane-destinations'

export type ActivityTerminalPortalTarget = {
  owner?: 'activity' | 'agent-hub'
  priority?: number
  slotId: string
  requestToken: string
  target: HTMLElement
  worktreeId: string
  tabId: string
  // Carry the durable leaf paneKey; TerminalPane resolves its current numeric handle immediately before isolation.
  paneKey: string
  forceUnavailable?: boolean
  active: boolean
}

let currentTargets: ActivityTerminalPortalTarget[] = []
const emptyTargets: ActivityTerminalPortalTarget[] = []
const subscribers = new Set<() => void>()

type ActivityTerminalPortalFieldEquals = (
  left: ActivityTerminalPortalTarget,
  right: ActivityTerminalPortalTarget
) => boolean

// Require every descriptor field in this keyed record; omitted equality checks would suppress publication and strand Terminal on stale routing.
const ACTIVITY_TERMINAL_PORTAL_FIELD_EQUALS: readonly ActivityTerminalPortalFieldEquals[] =
  Object.values({
    owner: (left, right) => left.owner === right.owner,
    priority: (left, right) => left.priority === right.priority,
    slotId: (left, right) => left.slotId === right.slotId,
    requestToken: (left, right) => left.requestToken === right.requestToken,
    target: (left, right) => left.target === right.target,
    worktreeId: (left, right) => left.worktreeId === right.worktreeId,
    tabId: (left, right) => left.tabId === right.tabId,
    paneKey: (left, right) => left.paneKey === right.paneKey,
    forceUnavailable: (left, right) => left.forceUnavailable === right.forceUnavailable,
    active: (left, right) => left.active === right.active
  } satisfies Record<keyof ActivityTerminalPortalTarget, ActivityTerminalPortalFieldEquals>)

function haveSameActivityTerminalPortals(
  left: readonly ActivityTerminalPortalTarget[],
  right: readonly ActivityTerminalPortalTarget[]
): boolean {
  return (
    left.length === right.length &&
    left.every((target, index) => {
      const candidate = right[index]
      return (
        candidate !== undefined &&
        ACTIVITY_TERMINAL_PORTAL_FIELD_EQUALS.every((isEqual) => isEqual(target, candidate))
      )
    })
  )
}

// Publish worktree/tab routing with the target; deriving it from global active state briefly portaled the wrong terminal when activation writes arrived separately.
export function setActivityTerminalPortals(targets: ActivityTerminalPortalTarget[]): void {
  // Why: semantic no-ops must not synchronously bounce through Terminal and back into Activity.
  if (currentTargets === targets || haveSameActivityTerminalPortals(currentTargets, targets)) {
    return
  }
  for (const previous of currentTargets) {
    if (!targets.some((target) => target.target === previous.target)) {
      returnRetainedPaneDestinationHome(previous.target)
    }
  }
  currentTargets = targets
  for (const subscriber of subscribers) {
    subscriber()
  }
}

// The Agent Hub's mirror windows: honored in every view, not only while Activity is open.
let agentHubTargets: ActivityTerminalPortalTarget[] = []
const combinedTargets = new WeakMap<
  ActivityTerminalPortalTarget[],
  {
    agentHub: ActivityTerminalPortalTarget[]
    targets: ActivityTerminalPortalTarget[]
  }
>()

export function setAgentHubTerminalPortals(targets: ActivityTerminalPortalTarget[]): void {
  if (agentHubTargets === targets || haveSameActivityTerminalPortals(agentHubTargets, targets)) {
    return
  }
  for (const previous of agentHubTargets) {
    if (!targets.some((target) => target.target === previous.target)) {
      returnRetainedPaneDestinationHome(previous.target)
    }
  }
  agentHubTargets = targets
  for (const subscriber of subscribers) {
    subscriber()
  }
}

// Why cached: useSyncExternalStore needs the same array until either list changes.
function withAgentHubTargets(
  activity: ActivityTerminalPortalTarget[]
): ActivityTerminalPortalTarget[] {
  if (agentHubTargets.length === 0) {
    return activity
  }
  let combined = combinedTargets.get(activity)
  if (combined?.agentHub !== agentHubTargets) {
    combined = { agentHub: agentHubTargets, targets: [...activity, ...agentHubTargets] }
    combinedTargets.set(activity, combined)
  }
  return combined.targets
}

function subscribeActivityTerminalPortals(onStoreChange: () => void): () => void {
  subscribers.add(onStoreChange)
  return () => {
    subscribers.delete(onStoreChange)
  }
}

export function useActivityTerminalPortals(enabled: boolean): ActivityTerminalPortalTarget[] {
  // Subscribe directly to module state so Terminal can consume targets without app-store routing.
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => subscribeActivityTerminalPortals(onStoreChange),
    []
  )

  const getSnapshot = useCallback(
    () => withAgentHubTargets(enabled ? currentTargets : emptyTargets),
    [enabled]
  )

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function findActivityTerminalPortal(
  targets: ActivityTerminalPortalTarget[],
  query: {
    worktreeId: string
    tabId: string
    slotId?: string
    paneKey?: string
    requestToken?: string
  }
): ActivityTerminalPortalTarget | null {
  const matchingTab = targets.filter(
    (target) => target.worktreeId === query.worktreeId && target.tabId === query.tabId
  )
  const hubTargets = matchingTab.filter((target) => target.owner === 'agent-hub')
  if (hubTargets.length > 0) {
    // Why: Hub ownership outranks Activity even when its quiet restore does not request focus.
    const winner = hubTargets.toSorted(
      (left, right) =>
        (right.priority ?? 0) - (left.priority ?? 0) || left.slotId.localeCompare(right.slotId)
    )[0]
    if (
      (query.slotId !== undefined && query.slotId !== winner.slotId) ||
      (query.paneKey !== undefined && query.paneKey !== winner.paneKey) ||
      (query.requestToken !== undefined && query.requestToken !== winner.requestToken)
    ) {
      return null
    }
    return winner
  }
  if (
    query.slotId !== undefined ||
    query.paneKey !== undefined ||
    query.requestToken !== undefined
  ) {
    const exact = matchingTab.find(
      (target) =>
        (query.slotId === undefined || target.slotId === query.slotId) &&
        (query.paneKey === undefined || target.paneKey === query.paneKey) &&
        (query.requestToken === undefined || target.requestToken === query.requestToken)
    )
    if (exact) {
      return exact
    }
  }
  return (
    matchingTab.find((target) => target.active) ??
    (matchingTab.length === 1 ? matchingTab[0] : null) ??
    null
  )
}

import { create } from 'zustand'
import { useAppStore } from '@/store'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import { resolveAgentHubPtyId, type AgentHubPaneTarget } from './agent-hub-pane-target'
import { resolveAgentHubTargetTerminal } from './agent-hub-target-terminal'

export type AgentHubOrbFocusTarget = {
  target: AgentHubPaneTarget
  ptyId: string
  terminalHandle?: string
  expiresAt: number
}
type FocusState = {
  watches: ReadonlyMap<string, AgentHubOrbFocusTarget>
  pinned: AgentHubOrbFocusTarget | null
}
export const useAgentHubOrbFocusStore = create<FocusState>(() => ({
  watches: new Map(),
  pinned: null
}))
export const agentHubOrbTargetKey = (target: AgentHubPaneTarget): string => {
  const leaf = useAppStore.getState().terminalLayoutsByTabId[target.tab.id]?.activeLeafId
  return JSON.stringify([
    getWorktreeHostIdentity(target.worktree),
    target.tab.id,
    target.paneKey ?? (leaf ? makePaneKey(target.tab.id, leaf) : null)
  ])
}

function capture(target: AgentHubPaneTarget, minutes: number): AgentHubOrbFocusTarget | null {
  const state = useAppStore.getState()
  const leaf = state.terminalLayoutsByTabId[target.tab.id]?.activeLeafId
  const paneKey = target.paneKey ?? (leaf ? makePaneKey(target.tab.id, leaf) : null)
  const ptyId = resolveAgentHubPtyId(state, target.tab.id, paneKey)
  return paneKey && ptyId
    ? { target: { ...target, paneKey }, ptyId, expiresAt: Date.now() + minutes * 60_000 }
    : null
}

export function agentHubOrbFocusTargetCurrent(
  item: AgentHubOrbFocusTarget,
  now = Date.now()
): boolean {
  const state = useAppStore.getState()
  return (
    item.expiresAt > now &&
    state.tabsByWorktree[item.target.worktree.id]?.some((tab) => tab.id === item.target.tab.id) ===
      true &&
    resolveAgentHubPtyId(state, item.target.tab.id, item.target.paneKey) === item.ptyId
  )
}

function resolveCapturedTerminal(item: AgentHubOrbFocusTarget): void {
  void resolveAgentHubTargetTerminal(item.target, item.ptyId)
    .then(({ terminal }) => {
      if (!agentHubOrbFocusTargetCurrent(item)) {
        return
      }
      useAgentHubOrbFocusStore.setState((state) => {
        const key = agentHubOrbTargetKey(item.target)
        const watches = new Map(state.watches)
        if (watches.get(key) === item) {
          watches.set(key, { ...item, terminalHandle: terminal })
        }
        return {
          watches,
          pinned: state.pinned === item ? { ...item, terminalHandle: terminal } : state.pinned
        }
      })
    })
    .catch(() => {})
}

export function toggleAgentHubOrbWatch(target: AgentHubPaneTarget): void {
  const captured = capture(target, 30)
  const state = useAgentHubOrbFocusStore.getState()
  const key = agentHubOrbTargetKey(captured?.target ?? target)
  const watches = new Map(state.watches)
  if (watches.has(key)) {
    watches.delete(key)
  } else if (captured) {
    watches.set(key, captured)
  }
  useAgentHubOrbFocusStore.setState({ watches })
  if (captured && watches.get(key) === captured) {
    resolveCapturedTerminal(captured)
  }
}

export function toggleAgentHubOrbPin(target: AgentHubPaneTarget): void {
  const captured = capture(target, 60)
  const pinned = useAgentHubOrbFocusStore.getState().pinned
  useAgentHubOrbFocusStore.setState({
    pinned:
      pinned &&
      agentHubOrbTargetKey(pinned.target) === agentHubOrbTargetKey(captured?.target ?? target)
        ? null
        : captured
  })
  if (captured && useAgentHubOrbFocusStore.getState().pinned === captured) {
    resolveCapturedTerminal(captured)
  }
}

export function pruneAgentHubOrbFocus(now = Date.now()): void {
  const state = useAgentHubOrbFocusStore.getState()
  const watches = new Map(
    [...state.watches].filter(([, item]) => agentHubOrbFocusTargetCurrent(item, now))
  )
  const pinned =
    state.pinned && agentHubOrbFocusTargetCurrent(state.pinned, now) ? state.pinned : null
  if (watches.size !== state.watches.size || pinned !== state.pinned) {
    useAgentHubOrbFocusStore.setState({ watches, pinned })
  }
}

type MirrorGesture = { owner: 'tab' | 'window'; pointerId: number }
let gesture: MirrorGesture | null = null
let tabClickBlocked = false
export function blockAgentHubMirrorTabClick(blocked: boolean): void {
  tabClickBlocked = blocked
}
export function isAgentHubMirrorTabClickBlocked(): boolean {
  return tabClickBlocked
}

export function claimAgentHubMirrorGesture(
  owner: MirrorGesture['owner'],
  pointerId: number
): boolean {
  if (gesture && (gesture.owner !== owner || gesture.pointerId !== pointerId)) {
    return false
  }
  gesture = { owner, pointerId }
  return true
}

export function releaseAgentHubMirrorGesture(owner: MirrorGesture['owner']): void {
  if (gesture?.owner === owner) {
    gesture = null
  }
}

export function agentHubMirrorGestureOwner(): MirrorGesture['owner'] | null {
  return gesture?.owner ?? null
}

const NO_WINDOW_MOVE =
  'button,input,textarea,select,[role="menu"],[role="menuitem"],[data-agent-hub-tab-strip],[data-agent-hub-tab-entry],[data-agent-hub-picker],[data-agent-hub-family-tabs]'

export function isAgentHubMirrorWindowDragTarget(target: EventTarget): boolean {
  return !(target instanceof Element) || target.closest(NO_WINDOW_MOVE) === null
}

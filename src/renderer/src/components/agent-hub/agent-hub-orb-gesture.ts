let active: { owner: object; pointerId: number } | null = null

export function claimAgentHubOrbGesture(owner: object, pointerId: number): boolean {
  if (active && (active.owner !== owner || active.pointerId !== pointerId)) {
    return false
  }
  active = { owner, pointerId }
  return true
}

export function releaseAgentHubOrbGesture(owner: object): void {
  if (active?.owner === owner) {
    active = null
  }
}

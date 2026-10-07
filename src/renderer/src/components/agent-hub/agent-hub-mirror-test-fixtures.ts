import { readAgentHubMirrors } from './agent-hub-mirror-store'
import { findAgentHubMirrorMembership } from './agent-hub-mirror-membership'

/** Tests address window operations by stable window identity, not a source pane key. */
export function mirrorWindowIdFor(targetKey: string): string {
  const owner = findAgentHubMirrorMembership(readAgentHubMirrors(), targetKey)
  if (!owner) {
    throw new Error(`No mirror contains ${targetKey}`)
  }
  return owner.window.id
}

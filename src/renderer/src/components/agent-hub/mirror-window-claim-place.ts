import { isAgentHubCanvasOpen } from './agent-hub-canvas-store'
import { snapMirrorGeometryToCanvas } from './agent-hub-canvas-dot-snap'
import {
  agentHubMirrorOpenGeometry,
  agentHubMirrorOpenRegion,
  clampAgentHubMirrorGeometry,
  defaultAgentHubMirrorSize,
  type AgentHubMirrorGeometry
} from './agent-hub-mirror-geometry'
import { agentHubWorkArea } from './agent-hub-floating-arrangement'
import {
  isAgentHubMirrorPlaceFree,
  readAgentHubMirrorOrigin,
  rememberAgentHubMirrorOrigin
} from './agent-hub-mirror-places'
import { viewportSize } from './mirror-window-canvas-snap'
import { readAgentHubMirrors } from './agent-hub-mirror-store'

// Why module scope: a new mirror opens at the size the user last gave one this session.
let lastResizedTo: { width: number; height: number } | null = null

/** A new mirror opens at the size the user last gave one. */
export function rememberLastMirrorSize(size: { width: number; height: number }): void {
  lastResizedTo = size
}

/**
 * A window's first place: where it stood before (see readAgentHubMirrorOrigin), else centred in the work area (beside the hub's
 * panel while that is open), stepping off the mirrors already open. The place is remembered at
 * once, so windows opening in the same commit step off each other too; asking again returns it.
 */
export function claimMirrorPlace(key: string, besideHubPanel: boolean): AgentHubMirrorGeometry {
  const viewport = viewportSize()
  const remembered = readAgentHubMirrorOrigin(key)
  if (remembered) {
    const kept = clampAgentHubMirrorGeometry(remembered, viewport, remembered)
    return isAgentHubMirrorPlaceFree(key) ? kept : (snapMirrorGeometryToCanvas(kept) ?? kept)
  }
  const panel = besideHubPanel
    ? document.querySelector('[data-agent-hub-panel]')?.getBoundingClientRect()
    : null
  const taken = readAgentHubMirrors().windows.flatMap(
    (open) => readAgentHubMirrorOrigin(open.id) ?? []
  )
  const place = clampAgentHubMirrorGeometry(
    agentHubMirrorOpenGeometry(
      lastResizedTo ?? defaultAgentHubMirrorSize(viewport),
      agentHubMirrorOpenRegion(agentHubWorkArea(), panel ?? null),
      taken,
      isAgentHubCanvasOpen()
    ),
    viewport
  )
  const landed = snapMirrorGeometryToCanvas(place) ?? place
  rememberAgentHubMirrorOrigin(key, landed)
  return landed
}

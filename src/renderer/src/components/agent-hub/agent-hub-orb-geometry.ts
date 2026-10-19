import type { AgentHubMirrorGeometry } from './agent-hub-mirror-geometry'

export const AGENT_HUB_ORB_MIN_DIAMETER = 128
export const AGENT_HUB_ORB_DEFAULT_DIAMETER = AGENT_HUB_ORB_MIN_DIAMETER
export const AGENT_HUB_ORB_MAX_DIAMETER = 360
export const AGENT_HUB_ORB_CARD_GAP = 14

export type AgentHubOrbBounds = { left: number; top: number; right: number; bottom: number }
export type AgentHubOrbSide = 'right' | 'left' | 'top' | 'bottom'
export type AgentHubOrbGeometry = AgentHubMirrorGeometry & {
  diameter: number
  minimum: number
  maximum: number
}
export type AgentHubOrbRequestPlacement = AgentHubMirrorGeometry & {
  side: AgentHubOrbSide
  placement: 'adjacent' | 'stack'
}

const WIDTH_OVERHEAD = 106
const HEIGHT_OVERHEAD = 116
const MIN_VISIBLE_DIAMETER = 32
const within = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(value, maximum))

export function fitAgentHubOrb({
  position,
  preferredDiameter,
  bounds,
  controlsWidth = 170,
  compact = false,
  heightOverhead = HEIGHT_OVERHEAD,
  maximumDiameter = AGENT_HUB_ORB_MAX_DIAMETER
}: {
  position: { x: number; y: number }
  preferredDiameter: number
  bounds: AgentHubOrbBounds
  controlsWidth?: number
  compact?: boolean
  heightOverhead?: number
  maximumDiameter?: number
}): AgentHubOrbGeometry {
  const width = Math.max(0, bounds.right - bounds.left)
  const height = Math.max(0, bounds.bottom - bounds.top)
  const minimumWidth = Math.min(width, Math.max(128 + WIDTH_OVERHEAD, controlsWidth + 24))
  const x = within(position.x, bounds.left, Math.max(bounds.left, bounds.right - minimumWidth))
  const y = within(
    position.y,
    bounds.top,
    Math.max(bounds.top, bounds.bottom - MIN_VISIBLE_DIAMETER - heightOverhead)
  )
  const maximum = Math.max(
    0,
    Math.floor(
      Math.min(
        AGENT_HUB_ORB_MAX_DIAMETER,
        compact ? AGENT_HUB_ORB_MIN_DIAMETER : AGENT_HUB_ORB_MAX_DIAMETER,
        maximumDiameter,
        bounds.right - x - WIDTH_OVERHEAD,
        bounds.bottom - y - heightOverhead
      )
    )
  )
  const minimum = Math.min(AGENT_HUB_ORB_MIN_DIAMETER, maximum)
  const diameter = Math.floor(within(preferredDiameter, minimum, maximum))
  return {
    x,
    y,
    diameter,
    minimum,
    maximum,
    width: Math.min(width, Math.max(diameter + WIDTH_OVERHEAD, controlsWidth + 24)),
    height: Math.min(height, diameter + heightOverhead)
  }
}

export function placeAgentHubOrbRequest({
  anchor,
  bounds,
  desiredSize,
  previousSide
}: {
  anchor: AgentHubMirrorGeometry
  bounds: AgentHubOrbBounds
  desiredSize: { width: number; height: number }
  previousSide?: AgentHubOrbSide
}): AgentHubOrbRequestPlacement | null {
  const gap = AGENT_HUB_ORB_CARD_GAP
  const candidates: (AgentHubOrbBounds & { side: AgentHubOrbSide })[] = [
    { ...bounds, left: anchor.x + anchor.width + gap, side: 'right' },
    { ...bounds, right: anchor.x - gap, side: 'left' },
    { ...bounds, bottom: anchor.y - gap, side: 'top' },
    { ...bounds, top: anchor.y + anchor.height + gap, side: 'bottom' }
  ]
  const wantedWidth = Math.min(desiredSize.width, bounds.right - bounds.left)
  const wantedHeight = Math.min(desiredSize.height, bounds.bottom - bounds.top)
  const usable = candidates.filter(
    (candidate) =>
      candidate.right - candidate.left >= Math.min(240, wantedWidth) &&
      candidate.bottom - candidate.top >= Math.min(140, wantedHeight)
  )
  const full = usable.filter(
    (candidate) =>
      candidate.right - candidate.left >= wantedWidth &&
      candidate.bottom - candidate.top >= wantedHeight
  )
  const choices = full.length ? full : usable
  choices.sort((a, b) => {
    const difference =
      (b.right - b.left) * (b.bottom - b.top) - (a.right - a.left) * (a.bottom - a.top)
    return difference || Number(b.side === previousSide) - Number(a.side === previousSide)
  })
  const selected = choices[0]
  if (!selected) {
    return null
  }
  const width = Math.min(wantedWidth, selected.right - selected.left)
  const height = Math.min(wantedHeight, selected.bottom - selected.top)
  return {
    side: selected.side,
    placement: 'adjacent',
    width,
    height,
    x:
      selected.side === 'right'
        ? selected.left
        : selected.side === 'left'
          ? selected.right - width
          : within(anchor.x + (anchor.width - width) / 2, selected.left, selected.right - width),
    y:
      selected.side === 'bottom'
        ? selected.top
        : selected.side === 'top'
          ? selected.bottom - height
          : within(anchor.y + (anchor.height - height) / 2, selected.top, selected.bottom - height)
  }
}

export function layoutAgentHubOrb(
  options: Parameters<typeof fitAgentHubOrb>[0] & {
    requestSize?: { width: number; height: number }
    previousSide?: AgentHubOrbSide
  }
): { orb: AgentHubOrbGeometry; request: AgentHubOrbRequestPlacement | null } {
  const orb = fitAgentHubOrb(options)
  if (!options.requestSize) {
    return { orb, request: null }
  }
  const request = placeAgentHubOrbRequest({
    anchor: orb,
    bounds: options.bounds,
    desiredSize: options.requestSize,
    previousSide: options.previousSide
  })
  if (request) {
    return { orb, request }
  }
  const { bounds, requestSize } = options
  const heightOverhead = options.heightOverhead ?? HEIGHT_OVERHEAD
  const width = Math.min(requestSize.width, bounds.right - bounds.left)
  const minimumCardHeight = Math.min(140, requestSize.height)
  const y = within(
    orb.y,
    bounds.top,
    Math.max(
      bounds.top,
      bounds.bottom -
        heightOverhead -
        AGENT_HUB_ORB_CARD_GAP -
        minimumCardHeight -
        MIN_VISIBLE_DIAMETER
    )
  )
  const fitted = fitAgentHubOrb({
    ...options,
    position: {
      x: within(orb.x, bounds.left, bounds.right - Math.max(orb.width, width)),
      y
    },
    maximumDiameter: Math.max(
      0,
      bounds.bottom - y - heightOverhead - AGENT_HUB_ORB_CARD_GAP - minimumCardHeight
    )
  })
  const stacked = { ...fitted, width: Math.max(fitted.width, width) }
  const cardY = stacked.y + stacked.height + AGENT_HUB_ORB_CARD_GAP
  return {
    orb: stacked,
    request: {
      x: within(stacked.x + (stacked.width - width) / 2, bounds.left, bounds.right - width),
      y: cardY,
      width,
      height: Math.max(0, Math.min(requestSize.height, bounds.bottom - cardY)),
      side: 'bottom',
      placement: 'stack'
    }
  }
}

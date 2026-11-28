import type { AgentSessionPluginJson } from '../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import { pluginCellsX, pluginCellsY } from './plugin-cell-metrics'

export type PluginProps = Record<string, AgentSessionPluginJson>

/** The d.ts's named spacing steps; a terminal has no scale, so these are cell counts. */
const SPACE_STEPS: Record<string, number> = { xs: 1, sm: 2, md: 3, lg: 4, xl: 6 }

export function readString(value: AgentSessionPluginJson | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function readNumber(value: AgentSessionPluginJson | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function readOneOf<T extends string>(
  value: AgentSessionPluginJson | undefined,
  allowed: readonly T[]
): T | undefined {
  return allowed.find((candidate) => candidate === value)
}

export function firstDefined(
  ...values: (AgentSessionPluginJson | undefined)[]
): AgentSessionPluginJson | undefined {
  return values.find((value) => value !== undefined && value !== null)
}

export function readCellCount(value: AgentSessionPluginJson | undefined): number | undefined {
  if (typeof value === 'string' && value in SPACE_STEPS) {
    return SPACE_STEPS[value]
  }
  return readNumber(value)
}

/** A cell count becomes ch or rows; a percent string passes through as a CSS percent. */
export function cellLength(
  value: AgentSessionPluginJson | undefined,
  axis: 'x' | 'y'
): string | undefined {
  if (typeof value === 'string' && /^-?\d+(\.\d+)?%$/.test(value)) {
    return value
  }
  const count = readCellCount(value)
  if (count === undefined) {
    return undefined
  }
  return axis === 'x' ? pluginCellsX(count) : pluginCellsY(count)
}

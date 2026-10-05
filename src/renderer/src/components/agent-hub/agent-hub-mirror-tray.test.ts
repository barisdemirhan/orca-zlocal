import { describe, expect, it } from 'vitest'
import type { AgentHubIndicatorKind } from './agent-hub-lists'
import {
  agentHubMirrorsToggleAction,
  foldAgentHubTray,
  orderAgentHubTray
} from './agent-hub-mirror-tray'

function entry(
  title: string,
  kind: AgentHubIndicatorKind,
  minimizedAt: number
): { title: string; chip: { minimizedAt: number }; kind: AgentHubIndicatorKind } {
  return { title, chip: { minimizedAt }, kind }
}

const titles = (entries: readonly { title: string }[]): string[] =>
  entries.map(({ title }) => title)

describe('agent hub mirror tray', () => {
  it('puts questions first, then results, then running work, newest first within each', () => {
    const ordered = orderAgentHubTray([
      entry('working-old', 'work', 1),
      entry('done', 'done', 2),
      entry('asking', 'ask', 3),
      entry('working-new', 'work', 4),
      entry('idle', 'idle', 5)
    ])
    expect(titles(ordered)).toEqual(['asking', 'done', 'working-new', 'working-old', 'idle'])
  })

  it('folds everything past four into a count until the tray is opened', () => {
    const six = Array.from({ length: 6 }, (_, index) => index)
    expect(foldAgentHubTray(six, false)).toEqual({ shown: [0, 1, 2, 3], folded: 2 })
    expect(foldAgentHubTray(six, true)).toEqual({ shown: six, folded: 0 })
    expect(foldAgentHubTray([0, 1, 2, 3], false)).toEqual({ shown: [0, 1, 2, 3], folded: 0 })
  })
})

describe('agentHubMirrorsToggleAction', () => {
  it('brings parked mirrors back first, beside the ones already open', () => {
    expect(agentHubMirrorsToggleAction({ windows: 0, chips: 3 })).toBe('restore')
    expect(agentHubMirrorsToggleAction({ windows: 1, chips: 2 })).toBe('restore')
  })

  it('sends them all to the hub once every mirror is open, or no more windows fit', () => {
    expect(agentHubMirrorsToggleAction({ windows: 3, chips: 0 })).toBe('dock')
    expect(agentHubMirrorsToggleAction({ windows: 4, chips: 2 }, 4)).toBe('dock')
    expect(agentHubMirrorsToggleAction({ windows: 4, chips: 2 }, 6)).toBe('restore')
  })

  it('does nothing without mirrors', () => {
    expect(agentHubMirrorsToggleAction({ windows: 0, chips: 0 })).toBe('none')
  })
})

import { describe, expect, it } from 'vitest'
import type { AgentHubIndicatorKind } from './agent-hub-lists'
import { foldAgentHubTray, orderAgentHubTray } from './agent-hub-mirror-tray'

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

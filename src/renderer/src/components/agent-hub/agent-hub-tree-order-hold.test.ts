import { describe, expect, it } from 'vitest'
import type { AgentHubGroupNode, AgentHubTerminalRow } from './agent-hub-terminal-tree'
import {
  agentHubTreePlaces,
  holdAgentHubTreePlaces,
  sameAgentHubTreePlaces
} from './agent-hub-tree-order-hold'

// Only the keys and nesting matter to the hold; the rest of a node is carried through untouched.
function row(key: string): AgentHubTerminalRow {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the hold reads only key and children.
  return { key, children: [] } as unknown as AgentHubTerminalRow
}

function tree(shape: Record<string, Record<string, string[]>>): AgentHubGroupNode[] {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the hold reads only keys, workspaces and rows.
  return Object.entries(shape).map(([key, workspaces]) => ({
    key,
    workspaces: Object.entries(workspaces).map(([workspace, rows]) => ({
      key: workspace,
      rows: rows.map(row)
    }))
  })) as unknown as AgentHubGroupNode[]
}

const keys = (groups: readonly AgentHubGroupNode[]): string =>
  groups
    .map(
      (group) =>
        `${group.key}[${group.workspaces
          .map((workspace) => `${workspace.key}(${workspace.rows.map((r) => r.key).join(',')})`)
          .join(' ')}]`
    )
    .join(' ')

describe('holding the hub tree order', () => {
  it('keeps rows, workspaces and groups where they stood while a new order settles', () => {
    const before = tree({ a: { w1: ['x', 'y'], w2: ['z'] }, b: { w3: ['q'] } })
    const after = tree({ b: { w3: ['q'] }, a: { w2: ['z'], w1: ['y', 'x'] } })
    const held = agentHubTreePlaces(before)
    expect(sameAgentHubTreePlaces(held, agentHubTreePlaces(after))).toBe(false)
    expect(keys(holdAgentHubTreePlaces(after, held))).toBe(keys(before))
  })

  it('lists what the held order has not seen after the rest, in its fresh order', () => {
    const held = agentHubTreePlaces(tree({ a: { w1: ['x'] } }))
    const after = tree({ n: { w9: ['new'] }, a: { w1: ['fresh', 'x'] } })
    expect(keys(holdAgentHubTreePlaces(after, held))).toBe('a[w1(x,fresh)] n[w9(new)]')
  })

  it('reports an unchanged order as the same', () => {
    const shape = { a: { w1: ['x', 'y'] } }
    expect(
      sameAgentHubTreePlaces(agentHubTreePlaces(tree(shape)), agentHubTreePlaces(tree(shape)))
    ).toBe(true)
  })
})

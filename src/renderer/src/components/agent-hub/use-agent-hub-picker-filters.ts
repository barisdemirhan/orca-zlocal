import { useMemo, useState } from 'react'
import type { Worktree } from '../../../../shared/worktree/types'
import { agentHubPickerBots, filterAgentHubTreeByBots } from './agent-hub-picker-bot-filter'
import {
  agentHubPickerProjectKeys,
  agentHubPickerProjects,
  filterAgentHubTreeByProjects
} from './agent-hub-picker-project-filter'
import type { AgentHubMirrorState } from './agent-hub-mirror-store'
import { availableAgentHubPickerTree } from './agent-hub-picker-tree'
import { agentOnlyAgentHubTree, type AgentHubGroupNode } from './agent-hub-terminal-tree'
import { filterAgentHubTerminalTree } from './agent-hub-terminal-tree-view'

export function countAgentHubTreeRows(tree: readonly { rowCount: number }[]): number {
  return tree.reduce((count, group) => count + group.rowCount, 0)
}

/** The picker's project and bot filters: their state, the tree they leave, and what they hide. */
export function useAgentHubPickerFilters({
  tree,
  mirrors,
  hostLabels,
  windowWorktrees,
  section,
  query,
  onSelectionChange
}: {
  tree: readonly AgentHubGroupNode[]
  mirrors: AgentHubMirrorState
  hostLabels: ReadonlyMap<string, string> | undefined
  windowWorktrees: readonly Pick<Worktree, 'id' | 'hostId' | 'repoId'>[]
  section: 'agents' | 'all'
  query: string
  onSelectionChange: () => void
}) {
  // From the full tree, so the window's own projects stay listed even with nothing left to add.
  const projects = useMemo(() => agentHubPickerProjects(tree, hostLabels), [tree, hostLabels])
  // Projects start from this window's tabs once per open; bots start empty. The popover unmounts on close.
  const [chosenProjects, setChosenProjects] = useState<ReadonlySet<string>>(() =>
    agentHubPickerProjectKeys(windowWorktrees)
  )
  const [chosenBots, setChosenBots] = useState<ReadonlySet<string>>(() => new Set())
  const unfiltered = useMemo(() => availableAgentHubPickerTree(tree, mirrors), [tree, mirrors])
  const bots = useMemo(() => agentHubPickerBots(unfiltered), [unfiltered])
  const projectKeys = useMemo(
    () => new Set(projects.filter((project) => chosenProjects.has(project.key)).map((p) => p.key)),
    [projects, chosenProjects]
  )
  const botKeys = useMemo(
    () => new Set(bots.filter((entry) => chosenBots.has(entry.key)).map((entry) => entry.key)),
    [bots, chosenBots]
  )
  const available = useMemo(
    () => filterAgentHubTreeByBots(filterAgentHubTreeByProjects(unfiltered, projectKeys), botKeys),
    [unfiltered, projectKeys, botKeys]
  )
  const agentTree = useMemo(() => agentOnlyAgentHubTree(available), [available])
  const sectionTree = section === 'agents' ? agentTree : available
  const queried = useMemo(
    () => filterAgentHubTerminalTree(sectionTree, query),
    [sectionTree, query]
  )
  const active = projectKeys.size > 0 || botKeys.size > 0
  const outsideCount = useMemo(() => {
    if (!active) {
      return 0
    }
    const all = section === 'agents' ? agentOnlyAgentHubTree(unfiltered) : unfiltered
    return (
      countAgentHubTreeRows(filterAgentHubTerminalTree(all, query)) - countAgentHubTreeRows(queried)
    )
  }, [active, section, unfiltered, query, queried])
  const changeProjects = (next: ReadonlySet<string>): void => {
    setChosenProjects(next)
    onSelectionChange()
  }
  const changeBots = (next: ReadonlySet<string>): void => {
    setChosenBots(next)
    onSelectionChange()
  }
  const clear = (): void => {
    setChosenProjects(new Set())
    setChosenBots(new Set())
    onSelectionChange()
  }
  return {
    projects,
    bots,
    projectKeys,
    botKeys,
    active,
    available,
    agentTree,
    sectionTree,
    queried,
    outsideCount,
    changeProjects,
    changeBots,
    clear
  }
}

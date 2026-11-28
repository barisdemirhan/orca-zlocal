import { useMemo, useState } from 'react'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import type { AgentHubGroupNode, AgentHubTerminalRow } from './agent-hub-terminal-tree'
import { useAgentHubHostLabels } from './use-agent-hub-host-labels'

export type AgentHubHostOption = { id: string; label: string }

export type AgentHubHostFilter = {
  /** The host the list is narrowed to; null shows every host. */
  value: string | null
  /** Hosts with terminals in the list; empty when they all run on one host. */
  options: readonly AgentHubHostOption[]
  onChange: (host: string | null) => void
  rowTest: ((row: AgentHubTerminalRow) => boolean) | undefined
}

function hostOptions(
  tree: readonly AgentHubGroupNode[],
  labels: ReadonlyMap<string, string> | undefined
): AgentHubHostOption[] {
  if (!labels) {
    return []
  }
  const options = new Map<string, string>()
  for (const group of tree) {
    for (const workspace of group.workspaces) {
      const id = getWorktreeHostIdentity(workspace.worktree)
      const label = labels.get(id)
      if (label && !options.has(id)) {
        options.set(id, label)
      }
    }
  }
  return options.size < 2 ? [] : [...options].map(([id, label]) => ({ id, label }))
}

/** Narrows the hub's lists to one host's terminals when they span several hosts. */
export function useAgentHubHostFilter(
  tree: readonly AgentHubGroupNode[],
  onChanged: () => void
): AgentHubHostFilter {
  const labels = useAgentHubHostLabels()
  const [selected, setSelected] = useState<string | null>(null)
  const options = useMemo(() => hostOptions(tree, labels), [tree, labels])
  // A host that left the list stops narrowing it instead of leaving it empty.
  const value = options.some((option) => option.id === selected) ? selected : null
  const rowTest = useMemo(
    () =>
      value === null
        ? undefined
        : (row: AgentHubTerminalRow) => getWorktreeHostIdentity(row.worktree) === value,
    [value]
  )
  const onChange = (host: string | null): void => {
    setSelected(host)
    onChanged()
  }
  return { value, options, onChange, rowTest }
}

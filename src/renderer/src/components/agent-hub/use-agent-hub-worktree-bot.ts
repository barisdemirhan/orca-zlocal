import { useMemo } from 'react'
import { useBots } from '@/lib/bot-catalog'
import { useAppStoreWithHostStatuses } from '@/store/slices/runtime-status/views/use-app-store-with-host-statuses'
import { selectFolderAncestorsByIdentity, botOfFolders } from '../bots/use-worktree-bot'
import { findBotByWorkspace } from '../bots/bot-workspace'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import type { FolderWorkspace } from '../../../../shared/folder-workspaces/folder-workspace-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { useAgentHubBotsActive } from './agent-hub-bot-identity'
import type { AgentHubRowBot } from './agent-hub-terminal-tree'

const NO_ANCESTORS: ReadonlyMap<string, readonly FolderWorkspace[]> = new Map()

/** Which bot a workspace belongs to, as the tree and chips need it; undefined while bots are off. */
export function useAgentHubWorktreeBot():
  | ((worktree: Pick<Worktree, 'id' | 'hostId'>) => AgentHubRowBot | null)
  | undefined {
  const active = useAgentHubBotsActive()
  const bots = useBots(active)
  const ancestors = useAppStoreWithHostStatuses((s, statuses) =>
    active ? selectFolderAncestorsByIdentity(s, statuses) : NO_ANCESTORS
  )
  return useMemo(() => {
    if (!active || bots.length === 0) {
      return undefined
    }
    return (worktree) => {
      const home = findBotByWorkspace(bots, worktree.id, worktree.hostId)
      if (home) {
        return { bot: home, home: true }
      }
      const worker = botOfFolders(ancestors.get(getWorktreeHostIdentity(worktree)) ?? [], bots)
      return worker ? { bot: worker, home: false } : null
    }
  }, [active, bots, ancestors])
}

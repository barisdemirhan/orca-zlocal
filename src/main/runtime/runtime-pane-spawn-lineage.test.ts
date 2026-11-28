import { expect, it, vi } from 'vitest'
import { getDefaultWorkspaceSession } from '../../shared/orca-profiles/constants'
import type { WorkspaceSessionState } from '../../shared/workspace-session/workspace-session-state-types'
import { RuntimePaneSpawnLineage } from './runtime-pane-spawn-lineage'

it('restores folder-workspace lineage only for tabs and leaves still in the saved session', () => {
  const childLeaf = '11111111-1111-4111-8111-111111111111'
  const grandchildLeaf = '22222222-2222-4222-8222-222222222222'
  const removedLeaf = '33333333-3333-4333-8333-333333333333'
  const child = `surviving-tab:${childLeaf}`
  const grandchild = `surviving-tab:${grandchildLeaf}`
  const stale = `surviving-tab:${removedLeaf}`
  let session: WorkspaceSessionState = {
    ...getDefaultWorkspaceSession(),
    tabsByWorktree: {
      'folder:project': [
        {
          id: 'surviving-tab',
          ptyId: null,
          worktreeId: 'folder:project',
          title: 'Shell',
          customTitle: null,
          color: null,
          sortOrder: 0,
          createdAt: 0
        }
      ]
    },
    terminalLayoutsByTabId: {
      'surviving-tab': {
        root: {
          type: 'split',
          direction: 'horizontal',
          first: { type: 'leaf', leafId: childLeaf },
          second: { type: 'leaf', leafId: grandchildLeaf }
        },
        activeLeafId: childLeaf,
        expandedLeafId: null
      }
    },
    terminalSpawnedByPaneKey: {
      [child]: { paneKey: `removed-tab:${removedLeaf}` },
      [grandchild]: { paneKey: child },
      [stale]: { paneKey: child }
    }
  }
  const publish = vi.fn()
  const lineage = new RuntimePaneSpawnLineage({
    read: () => session,
    write: (next) => {
      session = next
    },
    resolveLivePane: () => null,
    publish
  })
  lineage.restore()
  expect(session.terminalSpawnedByPaneKey).toEqual({ [grandchild]: { paneKey: child } })
  expect(lineage.get(child)).toBeUndefined()
  expect(lineage.get(stale)).toBeUndefined()
  expect(publish).toHaveBeenCalledWith(grandchild, { paneKey: child })
  expect(publish).toHaveBeenCalledWith(child, undefined)
  expect(publish).toHaveBeenCalledWith(stale, undefined)
})

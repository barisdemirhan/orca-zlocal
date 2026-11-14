import type { WorkspaceSessionState } from '../../../shared/workspace-session/workspace-session-state-types'

export type SessionFieldRepoRemovalDisposition =
  /** Delete map keys belonging to the repo. */
  | 'prunedByOwnerKey'
  /** Prune by derived IDs, pane keys or scalar rules. */
  | 'prunedByBespokeRule'
  /** Untouched here; entries below distinguish other pruning paths from known residue. */
  | 'notRepoScoped'

export type SessionFieldTransferDisposition =
  /** Rekey to the destination repo and clone values. */
  | 'copiedByOwnerKey'
  /** Copy with element-level rekeying or filtering. */
  | 'copiedByBespokeRule'
  /** Source-profile-only entities cannot transfer. */
  | 'notTransferred'

type SessionFieldDisposition = {
  onRepoRemoval: SessionFieldRepoRemovalDisposition
  onTransfer: SessionFieldTransferDisposition
}

/**
 * Every persisted session field, and what the repo-removal and project-transfer paths owe it.
 *
 * Why this exists: `clientHostedBrowserPagesByWorktree` was added to the session type and then
 * missed by three separate prune paths, because nothing made handling it mandatory. Classification
 * is now a compile error to skip, and the two owner-keyed lists below are what those paths
 * actually iterate -- so a field marked `prunedByOwnerKey` is pruned by construction.
 *
 * Not covered: `mergeWorkspaceSessions`, the apply side of a transfer, is still a hand-written
 * field list. It is safe for this field only because `extractSessionForTransfer` never emits it --
 * classify a new field as transferable and that merge has to be edited by hand.
 */
export const WORKSPACE_SESSION_FIELD_DISPOSITION = {
  // Residue: it can name the repo being removed, and no main-side path clears it. Harmless only
  // because every renderer read resolves it against the live repo list, so a dead id reads as none.
  terminalSpawnedByPaneKey: { onRepoRemoval: 'prunedByBespokeRule', onTransfer: 'notTransferred' },
  activeRepoId: { onRepoRemoval: 'notRepoScoped', onTransfer: 'notTransferred' },
  activeWorkspaceKey: { onRepoRemoval: 'prunedByBespokeRule', onTransfer: 'copiedByBespokeRule' },
  activeWorkspaceExecutionHostId: { onRepoRemoval: 'notRepoScoped', onTransfer: 'notTransferred' },
  activeWorktreeId: { onRepoRemoval: 'prunedByBespokeRule', onTransfer: 'copiedByBespokeRule' },
  // Residue here specifically: the owner-removal path nulls this when it deletes the tab it names,
  // but repo removal does not, so it can outlive the tab.
  activeTabId: { onRepoRemoval: 'notRepoScoped', onTransfer: 'notTransferred' },
  tabsByWorktree: { onRepoRemoval: 'prunedByBespokeRule', onTransfer: 'copiedByBespokeRule' },
  // Keyed by tab id, so both paths follow the tab ids the terminal maps gave up or carried over.
  terminalLayoutsByTabId: {
    onRepoRemoval: 'prunedByBespokeRule',
    onTransfer: 'copiedByBespokeRule'
  },
  // Same tab-id keying as the layouts it shadows, so park scrollback follows the same tab ids.
  localOnlyScrollbackByTabId: {
    onRepoRemoval: 'prunedByBespokeRule',
    onTransfer: 'copiedByBespokeRule'
  },
  activeWorktreeIdsOnShutdown: {
    onRepoRemoval: 'prunedByBespokeRule',
    onTransfer: 'copiedByBespokeRule'
  },
  openFilesByWorktree: { onRepoRemoval: 'prunedByOwnerKey', onTransfer: 'copiedByBespokeRule' },
  activeFileIdByWorktree: { onRepoRemoval: 'prunedByOwnerKey', onTransfer: 'copiedByOwnerKey' },
  markdownFrontmatterVisible: {
    onRepoRemoval: 'prunedByBespokeRule',
    onTransfer: 'copiedByBespokeRule'
  },
  browserTabsByWorktree: {
    onRepoRemoval: 'prunedByBespokeRule',
    onTransfer: 'copiedByBespokeRule'
  },
  // Follow browser workspace IDs resolved above.
  browserPagesByWorkspace: {
    onRepoRemoval: 'prunedByBespokeRule',
    onTransfer: 'copiedByBespokeRule'
  },
  activeBrowserTabIdByWorktree: {
    onRepoRemoval: 'prunedByOwnerKey',
    onTransfer: 'copiedByOwnerKey'
  },
  // Paired devices/browser profiles are source-scoped; copying rows would strand unavailable tabs.
  clientHostedBrowserPagesByWorktree: {
    onRepoRemoval: 'prunedByOwnerKey',
    onTransfer: 'notTransferred'
  },
  // Environment cleanup debt outlives individual repos.
  clientHostedBrowserCloseIntentsByEnvironment: {
    onRepoRemoval: 'notRepoScoped',
    onTransfer: 'notTransferred'
  },
  pairedTerminalTabCloseIntentsByEnvironment: {
    onRepoRemoval: 'notRepoScoped',
    onTransfer: 'notTransferred'
  },
  activeTabTypeByWorktree: { onRepoRemoval: 'prunedByOwnerKey', onTransfer: 'copiedByOwnerKey' },
  browserUrlHistory: { onRepoRemoval: 'notRepoScoped', onTransfer: 'notTransferred' },
  workspaceDocHistory: { onRepoRemoval: 'notRepoScoped', onTransfer: 'notTransferred' },
  activeTabIdByWorktree: { onRepoRemoval: 'prunedByOwnerKey', onTransfer: 'copiedByOwnerKey' },
  unifiedTabs: { onRepoRemoval: 'prunedByOwnerKey', onTransfer: 'copiedByBespokeRule' },
  tabGroups: { onRepoRemoval: 'prunedByOwnerKey', onTransfer: 'copiedByBespokeRule' },
  tabGroupLayouts: { onRepoRemoval: 'prunedByOwnerKey', onTransfer: 'copiedByOwnerKey' },
  activeGroupIdByWorktree: { onRepoRemoval: 'prunedByOwnerKey', onTransfer: 'copiedByOwnerKey' },
  activeConnectionIdsAtShutdown: { onRepoRemoval: 'notRepoScoped', onTransfer: 'notTransferred' },
  // Residue: neither path prunes removed tabs’ remote session IDs.
  remoteSessionIdsByTabId: { onRepoRemoval: 'notRepoScoped', onTransfer: 'notTransferred' },
  lastVisitedAtByWorktreeId: { onRepoRemoval: 'prunedByOwnerKey', onTransfer: 'copiedByOwnerKey' },
  defaultTerminalTabsAppliedByWorktreeId: {
    onRepoRemoval: 'prunedByOwnerKey',
    onTransfer: 'copiedByOwnerKey'
  },
  // Owner scans prune by worktreeId, but cross-profile source removal has no scan and leaves residue.
  sleepingAgentSessionsByPaneKey: { onRepoRemoval: 'notRepoScoped', onTransfer: 'notTransferred' },
  terminalPtyIncarnationsByPaneKey: {
    onRepoRemoval: 'prunedByBespokeRule',
    onTransfer: 'copiedByBespokeRule'
  },
  // Owner-key helpers also accept bare repo IDs.
  terminalTopologyRevisionByRepoId: {
    onRepoRemoval: 'prunedByOwnerKey',
    onTransfer: 'copiedByOwnerKey'
  },
  terminalSurfaceTombstonesByPaneKey: {
    onRepoRemoval: 'prunedByBespokeRule',
    onTransfer: 'copiedByBespokeRule'
  },
  // Pruned by worktreeId during owner removal; transferred source residue clears on next profile load.
  closedTerminalTabTombstonesByTabId: {
    onRepoRemoval: 'notRepoScoped',
    onTransfer: 'notTransferred'
  },
  // Owner removal prunes by worktreeId; closed panes do not transfer.
  closedTerminalPanesByPaneKey: {
    onRepoRemoval: 'notRepoScoped',
    onTransfer: 'notTransferred'
  }
} as const satisfies Record<keyof WorkspaceSessionState, SessionFieldDisposition>

// Missing classifications would leak state belonging to removed projects.
type UnclassifiedSessionField = Exclude<
  keyof WorkspaceSessionState,
  keyof typeof WORKSPACE_SESSION_FIELD_DISPOSITION
>
const exhaustive: [UnclassifiedSessionField] extends [never] ? true : never = true
void exhaustive

const SESSION_FIELDS = Object.keys(
  WORKSPACE_SESSION_FIELD_DISPOSITION
) as (keyof WorkspaceSessionState)[]

export const SESSION_FIELDS_PRUNED_BY_OWNER_KEY = SESSION_FIELDS.filter(
  (field) => WORKSPACE_SESSION_FIELD_DISPOSITION[field].onRepoRemoval === 'prunedByOwnerKey'
)

export const SESSION_FIELDS_COPIED_BY_OWNER_KEY = SESSION_FIELDS.filter(
  (field) => WORKSPACE_SESSION_FIELD_DISPOSITION[field].onTransfer === 'copiedByOwnerKey'
)

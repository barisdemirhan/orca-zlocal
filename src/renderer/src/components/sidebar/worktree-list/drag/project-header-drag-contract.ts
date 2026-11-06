import type { RootProjectHeaderDrag } from './root-project-header-drop'
import type { PointerEvent } from 'react'

import type { ProjectHeaderDragBucketKey, ProjectHeaderDragRect } from './project-header-drop'
import type { Repo } from '../../../../../../shared/repository/repo-types'
import type { ProjectGroup } from '../../../../../../shared/project/groups/project-group-types'

export type RepoDragState = {
  draggingRepoId: string | null
  dropIndex: number | null
  dropIndicatorY: number | null
  dropProjectGroupId: string | null
}

export const INITIAL_REPO_DRAG_STATE: RepoDragState = {
  draggingRepoId: null,
  dropIndex: null,
  dropIndicatorY: null,
  dropProjectGroupId: null
}

export function isSameRepoDragState(a: RepoDragState, b: RepoDragState): boolean {
  return (
    a.draggingRepoId === b.draggingRepoId &&
    a.dropIndex === b.dropIndex &&
    a.dropIndicatorY === b.dropIndicatorY &&
    a.dropProjectGroupId === b.dropProjectGroupId
  )
}

export type ProjectHeaderGroupDrop = {
  /** The list the rows were built from: it decides which header a project sits under. */
  projectGroups: readonly ProjectGroup[]
  canReorder: boolean
  canDropOnProjectGroupHeaders: boolean
  onCommitMoveToProjectGroup: (project: Repo, groupId: string) => void
}

export type UseRepoHeaderDragArgs = RootProjectHeaderDrag & {
  orderedRepoIds: string[]
  sidebarRepoHeaderIdsByBucket: ReadonlyMap<ProjectHeaderDragBucketKey, readonly string[]>
  repoById: ReadonlyMap<string, Repo>
  getLiveRepos: () => readonly Repo[]
  usesProjectGroupOrdering: boolean
  groupDrop: ProjectHeaderGroupDrop
  onCommitRepoOrder: (orderedIds: string[]) => void
  onCommitProjectGroupOrder: (project: Repo, projectGroupId: string | null, order: number) => void
  getScrollContainer: () => HTMLElement | null
}

export type RepoHeaderDragController = {
  state: RepoDragState
  onHandlePointerDown: (event: PointerEvent<HTMLElement>, repo: Repo) => void
}

export type ProjectHeaderDragSession = {
  // Why the row, not its id: a twin on another host shares the id.
  repo: Repo
  bucketKey: ProjectHeaderDragBucketKey
  ownProjectGroupHeaderId: string | null
  sidebarRepoHeaderIds: readonly string[]
  rootProjectHeaderKeys?: readonly string[]
  rootProjectHeaderHostId?: string
  pointerId: number
  headerRects: ProjectHeaderDragRect[]
  handleEl: HTMLElement
  startX: number
  startY: number
  latestPointerY: number
  promoted: boolean
}

export const PROJECT_HEADER_DRAG_THRESHOLD_PX = 4

const REPO_HEADER_DRAG_HANDLE_SELECTOR = '[data-repo-header-drag-handle]'

// Shared with project-group headers: both reuse ProjectHeaderActions markup.
export const REPO_HEADER_ACTION_SELECTOR =
  '[data-repo-header-actions], [data-repo-header-action], [data-repo-header-collapse-affordance], button, a, input, textarea, select, [contenteditable=""], [contenteditable="true"]'

export function isProjectHeaderDragHandleTarget(
  target: EventTarget | null,
  currentTarget: HTMLElement
): boolean {
  // SVG icons are Elements too; allow dragging by the project icon.
  if (!(target instanceof Element)) {
    return false
  }
  const dragHandle = target.closest(REPO_HEADER_DRAG_HANDLE_SELECTOR)
  return dragHandle !== null && currentTarget.contains(dragHandle)
}

export function isRepoHeaderActionTarget(
  target: EventTarget | null,
  currentTarget: HTMLElement
): boolean {
  // SVG action icons must not arm a header drag.
  if (!(target instanceof Element) || target === currentTarget) {
    return false
  }
  return currentTarget.contains(target) && target.closest(REPO_HEADER_ACTION_SELECTOR) !== null
}

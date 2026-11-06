import type {
  ProjectHeaderDragSession,
  ProjectHeaderGroupDrop,
  RepoDragState
} from './project-header-drag-contract'
import { computeProjectHeaderDropPreview } from './project-header-drop'
import type { WorktreeSidebarHeaderDrag } from './use-header-drag'

/** The group header under the pointer that a dragged project can join, if any. */
export function findProjectGroupHeaderDropTarget(args: {
  container: Pick<HTMLElement, 'querySelectorAll'>
  pointerY: number
  ownHeaderId: string | null
}): string | null {
  for (const element of args.container.querySelectorAll<HTMLElement>(
    '[data-project-group-drop-id]'
  )) {
    const { top, bottom } = element.getBoundingClientRect()
    if (args.pointerY >= top && args.pointerY < bottom) {
      const groupId = element.getAttribute('data-project-group-drop-id')
      // Why: over its own header a project just keeps reordering among its siblings.
      return groupId === args.ownHeaderId ? null : groupId
    }
  }
  return null
}

export type ProjectHeaderPointerDrop = Omit<RepoDragState, 'draggingRepoId'>

/** What releasing a dragged project here would do: join a group header, or take a slot among siblings. */
export function computeProjectHeaderPointerDrop(args: {
  session: Pick<
    ProjectHeaderDragSession,
    'ownProjectGroupHeaderId' | 'headerRects' | 'sidebarRepoHeaderIds'
  >
  container: HTMLElement
  pointerY: number
  groupDrop: Pick<ProjectHeaderGroupDrop, 'canReorder' | 'canDropOnProjectGroupHeaders'>
}): ProjectHeaderPointerDrop | null {
  const { session, container, pointerY, groupDrop } = args
  const dropProjectGroupId = groupDrop.canDropOnProjectGroupHeaders
    ? findProjectGroupHeaderDropTarget({
        container,
        pointerY,
        ownHeaderId: session.ownProjectGroupHeaderId
      })
    : null
  if (dropProjectGroupId || !groupDrop.canReorder) {
    return { dropIndex: null, dropIndicatorY: null, dropProjectGroupId }
  }
  const preview = computeProjectHeaderDropPreview({
    pointerY,
    containerTop: container.getBoundingClientRect().top,
    scrollTop: container.scrollTop,
    rects: session.headerRects,
    sidebarRepoHeaderIds: session.sidebarRepoHeaderIds,
    contentBottom: container.scrollHeight
  })
  return preview && { ...preview, dropProjectGroupId: null }
}

export function getProjectHeaderDragFlags(
  headerDrag: Pick<
    WorktreeSidebarHeaderDrag,
    | 'canDropProjectsOnGroupHeaders'
    | 'canReorderRepoHeaders'
    | 'repoDrag'
    | 'sidebarRepoHeaderIdsByBucket'
  >,
  header: {
    projectId: string | undefined
    bucketKey: string | undefined
    projectGroupId: string | undefined
    /** Overrides the bucket's sibling count when a root-level drag spans mixed headers. */
    siblingCount?: number
  }
): {
  isDraggableRepoHeader: boolean
  isDraggingThis: boolean
  isProjectGroupDropTarget: boolean
} {
  const { draggingRepoId, dropProjectGroupId } = headerDrag.repoDrag.state
  const siblingCount =
    header.siblingCount ??
    (header.bucketKey
      ? (headerDrag.sidebarRepoHeaderIdsByBucket.get(
          header.bucketKey as Parameters<typeof headerDrag.sidebarRepoHeaderIdsByBucket.get>[0]
        )?.length ?? 0)
      : 0)
  return {
    isDraggableRepoHeader: Boolean(
      header.projectId &&
      header.bucketKey &&
      (headerDrag.canDropProjectsOnGroupHeaders ||
        (headerDrag.canReorderRepoHeaders && siblingCount > 1))
    ),
    isDraggingThis: draggingRepoId !== null && draggingRepoId === header.projectId,
    isProjectGroupDropTarget:
      header.projectGroupId !== undefined && dropProjectGroupId === header.projectGroupId
  }
}

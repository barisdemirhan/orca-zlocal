import { describe, expect, it } from 'vitest'
import {
  computeProjectHeaderPointerDrop,
  findProjectGroupHeaderDropTarget
} from './project-group-header-drop-target'
import { getProjectGroupTabOrderUpdatesForSidebarDrop } from './project-group-header-drop'
import { getProjectHeaderDragBucketKey } from './project-header-drop'
import type { ProjectGroup } from '../../../../../../shared/project/groups/project-group-types'

function header(groupId: string, top: number, bottom: number): HTMLElement {
  return {
    getAttribute: () => groupId,
    getBoundingClientRect: () => ({ top, bottom })
  } as unknown as HTMLElement
}

const container = {
  querySelectorAll: () => [header('work', 0, 28), header('home', 100, 128)]
} as unknown as Pick<HTMLElement, 'querySelectorAll'>

describe('the group header a dragged project is over', () => {
  it('finds the header under the pointer', () => {
    expect(findProjectGroupHeaderDropTarget({ container, pointerY: 110, ownHeaderId: null })).toBe(
      'home'
    )
  })

  it('finds nothing between headers', () => {
    expect(
      findProjectGroupHeaderDropTarget({ container, pointerY: 60, ownHeaderId: null })
    ).toBeNull()
  })

  it("does not offer the project's own header", () => {
    expect(
      findProjectGroupHeaderDropTarget({ container, pointerY: 10, ownHeaderId: 'work' })
    ).toBeNull()
  })
})

describe('where releasing a dragged project would put it', () => {
  const scrollingContainer = {
    ...container,
    querySelectorAll: container.querySelectorAll,
    scrollTop: 0,
    scrollHeight: 200,
    getBoundingClientRect: () => ({ top: 0 })
  } as unknown as HTMLElement
  const session = {
    ownProjectGroupHeaderId: 'work',
    headerRects: [
      { repoId: 'one', top: 40, bottom: 60, height: 20 },
      { repoId: 'two', top: 60, bottom: 80, height: 20 }
    ],
    sidebarRepoHeaderIds: ['one', 'two']
  } as never

  it('joins the header it is over instead of taking a slot', () => {
    expect(
      computeProjectHeaderPointerDrop({
        session,
        container: scrollingContainer,
        pointerY: 110,
        groupDrop: { canReorder: true, canDropOnProjectGroupHeaders: true }
      })
    ).toEqual({ dropIndex: null, dropIndicatorY: null, dropProjectGroupId: 'home' })
  })

  it('never offers a slot when projects are sorted by recent activity', () => {
    expect(
      computeProjectHeaderPointerDrop({
        session,
        container: scrollingContainer,
        pointerY: 70,
        groupDrop: { canReorder: false, canDropOnProjectGroupHeaders: true }
      })
    ).toEqual({ dropIndex: null, dropIndicatorY: null, dropProjectGroupId: null })
  })

  it('takes no header when one computer leaves nothing to join', () => {
    expect(
      computeProjectHeaderPointerDrop({
        session,
        container: scrollingContainer,
        pointerY: 110,
        groupDrop: { canReorder: true, canDropOnProjectGroupHeaders: false }
      })?.dropProjectGroupId
    ).not.toBe('home')
  })
})

describe("a project's reorder bucket under a merged header", () => {
  const groups = [
    { id: 'local', name: 'Work', parentGroupId: null, executionHostId: 'local', createdAt: 1 },
    {
      id: 'remote',
      name: 'Work',
      parentGroupId: null,
      executionHostId: 'runtime:env-1',
      createdAt: 2
    }
  ] as ProjectGroup[]

  it("is the same whichever host's group the project joined", () => {
    expect(getProjectHeaderDragBucketKey({ projectGroupId: 'remote' }, groups)).toBe(
      getProjectHeaderDragBucketKey({ projectGroupId: 'local' }, groups)
    )
  })

  it('stays the group id on one host', () => {
    expect(getProjectHeaderDragBucketKey({ projectGroupId: 'solo' })).toBe('group:solo')
  })
})

describe('reordering a merged project group header', () => {
  it("writes a merged header whose leader is already in place but whose other host's group is not", () => {
    const base = {
      parentPath: null,
      parentGroupId: null,
      createdFrom: 'manual',
      isCollapsed: false,
      color: null,
      createdAt: 1,
      updatedAt: 1
    } as const
    const groups: ProjectGroup[] = [
      { ...base, id: 'a', name: 'a', tabOrder: 0, executionHostId: 'local' },
      { ...base, id: 'b', name: 'b', tabOrder: 1, executionHostId: 'local' },
      { ...base, id: 'work', name: 'Work', tabOrder: 1, executionHostId: 'local' },
      { ...base, id: 'work-remote', name: 'Work', tabOrder: 7, executionHostId: 'runtime:env-b' }
    ]

    expect(
      getProjectGroupTabOrderUpdatesForSidebarDrop({
        sidebarProjectGroupHeaderIds: ['a', 'b', 'work'],
        draggedGroupId: 'work',
        sidebarDropIndex: 1,
        projectGroupById: new Map(groups.map((entry) => [entry.id, entry]))
      })
    ).toEqual([
      { groupId: 'work', tabOrder: 1 },
      { groupId: 'b', tabOrder: 2 }
    ])
  })
})

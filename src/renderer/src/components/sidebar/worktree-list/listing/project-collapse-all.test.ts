import { describe, expect, it } from 'vitest'
import type { ProjectGroup } from '../../../../../../shared/project/groups/project-group-types'
import {
  toggleMergedProjectGroupCollapse,
  withMergedProjectGroupCollapseKeys
} from './project-collapse-all'

describe('collapse keys behind a merged group header', () => {
  const groups = [
    { id: 'local', name: 'Work', parentGroupId: null, executionHostId: 'local', createdAt: 1 },
    {
      id: 'remote',
      name: 'Work',
      parentGroupId: null,
      executionHostId: 'runtime:env-1',
      createdAt: 2
    },
    { id: 'solo', name: 'Home', parentGroupId: null, executionHostId: 'local', createdAt: 3 }
  ] as ProjectGroup[]

  it('covers every member, so the header stays collapsed if another member comes to lead it', () => {
    expect(withMergedProjectGroupCollapseKeys(groups, ['project-group:local', 'repo:one'])).toEqual(
      ['project-group:local', 'project-group:remote', 'repo:one']
    )
  })

  it('expands only the toggled header, leaving other collapsed projects alone', () => {
    const collapsed = new Set(['project-group:local', 'project-group:remote', 'repo:one'])

    expect(toggleMergedProjectGroupCollapse(collapsed, groups, 'project-group:local')).toEqual(
      new Set(['repo:one'])
    )
  })

  it('collapses every member from one toggle', () => {
    expect(toggleMergedProjectGroupCollapse(new Set(), groups, 'project-group:remote')).toEqual(
      new Set(['project-group:local', 'project-group:remote'])
    )
  })

  it('leaves a single-group header to the plain toggle', () => {
    expect(toggleMergedProjectGroupCollapse(new Set(), groups, 'project-group:solo')).toBeNull()
  })

  it('leaves an unmerged group its own key', () => {
    expect(withMergedProjectGroupCollapseKeys(groups, ['project-group:solo'])).toEqual([
      'project-group:solo'
    ])
  })
})

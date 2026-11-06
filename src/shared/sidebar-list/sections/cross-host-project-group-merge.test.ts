import { describe, expect, it } from 'vitest'
import type { ExecutionHostId } from '../../execution-host'
import type { ProjectGroup } from '../../project/groups/project-group-types'
import {
  getCrossHostProjectGroupMembers,
  getCrossHostProjectGroupMerge,
  isInProjectGroupHeader,
  resolveDisplayProjectGroupId
} from './cross-host-project-group-merge'

const REMOTE: ExecutionHostId = 'runtime:env-1'

function group(
  id: string,
  executionHostId: ExecutionHostId,
  overrides: Partial<ProjectGroup> = {}
): ProjectGroup {
  return {
    id,
    name: 'Work',
    parentPath: null,
    executionHostId,
    parentGroupId: null,
    createdFrom: 'manual',
    tabOrder: 0,
    isCollapsed: false,
    color: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

function headerIds(groups: ProjectGroup[]): string[] {
  return getCrossHostProjectGroupMerge(groups).displayGroups.map(({ id }) => id)
}

describe('groups sharing a header across hosts', () => {
  it('folds same-named top-level groups into the oldest one', () => {
    const groups = [
      group('remote', REMOTE, { createdAt: 1 }),
      group('local', 'local', { createdAt: 2 })
    ]

    expect(headerIds(groups)).toEqual(['remote'])
    expect(resolveDisplayProjectGroupId(groups, 'local')).toBe('remote')
    expect(getCrossHostProjectGroupMembers(groups, 'local').map(({ id }) => id)).toEqual([
      'remote',
      'local'
    ])
  })

  it('ignores case and surrounding spaces in the name', () => {
    expect(headerIds([group('a', 'local'), group('b', REMOTE, { name: ' work ' })])).toHaveLength(1)
  })

  it('keeps same-named groups on one host apart', () => {
    expect(headerIds([group('a', 'local'), group('b', 'local')])).toEqual(['a', 'b'])
  })

  it('keeps differently named groups apart', () => {
    expect(headerIds([group('a', 'local'), group('b', REMOTE, { name: 'Home' })])).toEqual([
      'a',
      'b'
    ])
  })

  it('folds nested groups only under the same merged parent', () => {
    const groups = [
      group('local-top', 'local', { name: 'Top' }),
      group('remote-top', REMOTE, { name: 'Top', createdAt: 2 }),
      group('local-nested', 'local', { name: 'Nested', parentGroupId: 'local-top' }),
      group('remote-nested', REMOTE, {
        name: 'Nested',
        parentGroupId: 'remote-top',
        createdAt: 2
      }),
      group('remote-other-top', REMOTE, { name: 'Other' }),
      group('remote-other-nested', REMOTE, { name: 'Nested', parentGroupId: 'remote-other-top' })
    ]

    const { displayGroups } = getCrossHostProjectGroupMerge(groups)

    expect(displayGroups.map(({ id }) => id).sort()).toEqual([
      'local-nested',
      'local-top',
      'remote-other-nested',
      'remote-other-top'
    ])
    expect(resolveDisplayProjectGroupId(groups, 'remote-nested')).toBe('local-nested')
    expect(resolveDisplayProjectGroupId(groups, 'remote-other-nested')).toBe('remote-other-nested')
  })

  it('points a remote-only child at the merged parent', () => {
    const groups = [
      group('local-top', 'local', { name: 'Top' }),
      group('remote-top', REMOTE, { name: 'Top', createdAt: 2 }),
      group('remote-child', REMOTE, { name: 'Child', parentGroupId: 'remote-top' })
    ]

    const child = getCrossHostProjectGroupMerge(groups).displayGroups.find(
      ({ id }) => id === 'remote-child'
    )

    expect(child?.parentGroupId).toBe('local-top')
  })

  it('leaves single-host catalogs as they are', () => {
    const groups = [
      group('top', 'local', { name: 'Top' }),
      group('nested', 'local', { name: 'Top', parentGroupId: 'top' })
    ]

    expect(getCrossHostProjectGroupMerge(groups).displayGroups).toEqual(groups)
    expect(getCrossHostProjectGroupMembers(groups, 'top').map(({ id }) => id)).toEqual(['top'])
    expect(resolveDisplayProjectGroupId(groups, 'nested')).toBe('nested')
  })

  it('splits a header back to one member when the other host is gone', () => {
    const remote = group('remote', REMOTE, { createdAt: 1 })
    const local = group('local', 'local', { createdAt: 2 })

    expect(headerIds([remote, local])).toEqual(['remote'])
    expect(headerIds([local])).toEqual(['local'])
  })

  it('tells whether a row sits under a header, whichever member it joined', () => {
    const groups = [group('local', 'local'), group('remote', REMOTE, { createdAt: 2 })]

    expect(isInProjectGroupHeader(groups, 'remote', 'local')).toBe(true)
    expect(isInProjectGroupHeader(groups, 'local', 'remote')).toBe(true)
    expect(isInProjectGroupHeader(groups, null, 'local')).toBe(false)
  })
})

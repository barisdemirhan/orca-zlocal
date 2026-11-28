import { describe, expect, it } from 'vitest'
import { planCanvasDotDrop } from './agent-hub-canvas-dot-resolve'
import { arrangeWindowsInCanvasDots, snapRectToCanvasDots } from './agent-hub-canvas-dot-grid'

const AREA = { left: 0, top: 0, width: 1100, height: 700 }

describe('canvas dot grid', () => {
  it('snaps a free box to whole dots', () => {
    expect(snapRectToCanvasDots({ left: 103, top: 50, width: 450, height: 250 }, AREA)).toEqual({
      left: 110,
      top: 44,
      width: 440,
      height: 242
    })
  })

  it('arranges side by side in whole cells with one dot between', () => {
    expect(arrangeWindowsInCanvasDots(2, AREA, 'columns')).toEqual([
      { left: 22, top: 22, width: 506, height: 660 },
      { left: 550, top: 22, width: 506, height: 660 }
    ])
  })

  it('cuts an overlapped neighbour back to leave one dot', () => {
    const wide = { left: 0, top: 0, width: 1500, height: 700 }
    const moved = { left: 44, top: 44, width: 440, height: 242 }
    const neighbour = { left: 440, top: 44, width: 660, height: 242 }
    expect(
      planCanvasDotDrop(moved, [{ key: 'a', rect: neighbour }], wide).neighbours.get('a')
    ).toEqual({
      left: 506,
      top: 44,
      width: 594,
      height: 242
    })
  })

  it('moves a neighbour that cannot shrink to the nearest free spot', () => {
    const short = { left: 0, top: 0, width: 1100, height: 400 }
    const moved = { left: 22, top: 22, width: 440, height: 242 }
    const neighbour = { left: 242, top: 22, width: 440, height: 242 }
    expect(
      planCanvasDotDrop(moved, [{ key: 'a', rect: neighbour }], short).neighbours.get('a')
    ).toEqual({ left: 484, top: 22, width: 440, height: 242 })
  })

  it('moves the dropped window aside when a neighbour can get no room', () => {
    const short = { left: 0, top: 0, width: 1100, height: 400 }
    const moved = { left: 242, top: 22, width: 440, height: 242 }
    const neighbour = { left: 22, top: 22, width: 440, height: 242 }
    const plan = planCanvasDotDrop(moved, [{ key: 'a', rect: neighbour }], short)
    expect(plan.target).toEqual({ left: 484, top: 22, width: 440, height: 242 })
    expect(plan.neighbours.size).toBe(0)
  })

  it('keeps a crowded arrangement inside the area, stepping over the cells', () => {
    expect(arrangeWindowsInCanvasDots(6, AREA, 'grid')).toEqual([
      { left: 22, top: 22, width: 506, height: 242 },
      { left: 550, top: 22, width: 506, height: 242 },
      { left: 22, top: 220, width: 506, height: 242 },
      { left: 550, top: 220, width: 506, height: 242 },
      { left: 22, top: 418, width: 506, height: 242 },
      { left: 550, top: 418, width: 506, height: 242 }
    ])
  })
})

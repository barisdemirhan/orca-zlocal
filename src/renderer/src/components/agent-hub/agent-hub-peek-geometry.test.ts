import { describe, expect, it } from 'vitest'
import { agentHubPeekGeometry } from './agent-hub-peek-geometry'

// A 2000x1000 work area under a 40px title bar; a new mirror there is 960x595.
const area = { left: 0, top: 40, width: 2000, height: 1000 }

describe('agentHubPeekGeometry', () => {
  it('gives a page or PDF 70% of the work area, centered', () => {
    expect(agentHubPeekGeometry(area, null, false)).toEqual({
      left: 300,
      top: 190,
      width: 1400,
      height: 700
    })
  })

  it.each([
    ['shrinks to a medium image plus its viewer', { width: 1100, height: 500 }, 1148, 640],
    ['keeps a small image at a new mirror size', { width: 200, height: 100 }, 960, 595],
    ['caps a large image at 70%', { width: 3000, height: 2000 }, 1400, 700]
  ])('%s', (_, content, width, height) => {
    expect(agentHubPeekGeometry(area, content, false)).toMatchObject({ width, height })
  })

  it('fills the work area in full screen', () => {
    expect(agentHubPeekGeometry(area, { width: 200, height: 100 }, true)).toEqual({
      left: 16,
      top: 56,
      width: 1968,
      height: 968
    })
  })

  it('lets the 70% cap win where a mirror-sized floor would be wider', () => {
    expect(
      agentHubPeekGeometry(
        { left: 0, top: 0, width: 700, height: 500 },
        { width: 10, height: 10 },
        false
      )
    ).toMatchObject({ width: 490, height: 347 })
  })
})

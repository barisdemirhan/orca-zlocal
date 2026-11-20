import { describe, expect, it } from 'vitest'
import { pluginTreeDrawsContent, sanitizePluginTree } from './claude-plugin-ui-tree'

describe('sanitizePluginTree', () => {
  it('keeps only type, props, children and press, and caps strings', () => {
    const tree = sanitizePluginTree({
      type: 'Text',
      props: { color: 'success' },
      children: ['x'.repeat(3000)],
      press: { plugin: 'deck', handle: 7, extra: 1 },
      secret: 'dropped'
    })
    expect(tree).toEqual({
      type: 'Text',
      props: { color: 'success' },
      children: [`${'x'.repeat(1999)}…`],
      press: { plugin: 'deck', handle: 7 }
    })
  })

  it('cuts a tree nested deeper than 24 levels', () => {
    let node: Record<string, unknown> = { type: 'Text' }
    for (let i = 0; i < 40; i += 1) {
      node = { type: 'Box', children: [node] }
    }
    let depth = 0
    for (
      let cursor = sanitizePluginTree(node);
      cursor && typeof cursor.children?.[0] === 'object';
      cursor = cursor.children[0]
    ) {
      depth += 1
    }
    expect(depth).toBeLessThanOrEqual(24)
  })

  it('treats a hint made only of engine nodes as empty', () => {
    const engineOnly = sanitizePluginTree({ type: 'Box', children: [{ type: 'engine' }] })
    expect(engineOnly && pluginTreeDrawsContent(engineOnly)).toBe(false)
    const drawn = sanitizePluginTree({ type: 'Box', children: [{ type: 'Text', children: ['a'] }] })
    expect(drawn && pluginTreeDrawsContent(drawn)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { ClaudePluginSurfaces } from './claude-plugin-surfaces'

const status = (plugin: string, text: string | null): Record<string, unknown> => ({
  type: 'system',
  subtype: 'ui_status',
  plugin,
  text
})

describe('ClaudePluginSurfaces', () => {
  it('keeps one line per plugin, replaces it, and removes it on null', () => {
    const surfaces = new ClaudePluginSurfaces()
    expect(surfaces.observe(status('a', 'one'))).toEqual({
      statuses: [{ plugin: 'a', text: 'one' }]
    })
    expect(surfaces.observe(status('b', 'two'))?.statuses).toHaveLength(2)
    expect(surfaces.observe(status('a', 'uno'))?.statuses).toEqual([
      { plugin: 'a', text: 'uno' },
      { plugin: 'b', text: 'two' }
    ])
    expect(surfaces.observe(status('a', 'uno'))).toBeNull()
    expect(surfaces.observe(status('a', null))?.statuses).toEqual([{ plugin: 'b', text: 'two' }])
    expect(surfaces.clear()).toBe(true)
    expect(surfaces.clear()).toBe(false)
  })

  it('caps status text and captures a toast with its id', () => {
    const surfaces = new ClaudePluginSurfaces()
    const long = 'x'.repeat(10_000)
    const line = surfaces.observe(status('a', long))?.statuses?.[0].text
    expect(line).toHaveLength(500)
    expect(line?.endsWith('…')).toBe(true)
    expect(
      surfaces.observe({
        type: 'system',
        subtype: 'ui_toast',
        plugin: 'a',
        text: 'hi',
        timeout_ms: 4000,
        uuid: 'u1'
      })
    ).toEqual({ toast: { id: 'u1', plugin: 'a', text: 'hi', timeoutMs: 4000 } })
  })
})

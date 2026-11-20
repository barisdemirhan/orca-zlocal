import { describe, expect, it, vi } from 'vitest'
import { ClaudePluginUiBridge } from './claude-plugin-ui-bridge'
import type { AgentSessionPluginSurfaceUpdate } from '../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'

const hint = (text: string) => ({
  type: 'Box',
  children: [{ type: 'Text', children: [text] }]
})

function setup(handler: (body: Record<string, unknown>) => unknown) {
  const calls: Record<string, unknown>[] = []
  const published: AgentSessionPluginSurfaceUpdate[] = []
  const request = vi.fn(async (body: Record<string, unknown>) => {
    calls.push(body)
    return handler(body)
  })
  const bridge = new ClaudePluginUiBridge({
    request,
    clientId: 'orca:s1',
    publish: (update) => published.push(update),
    debounceMs: 5
  })
  return { bridge, calls, published }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 30))

describe('ClaudePluginUiBridge', () => {
  it('attaches, then renders the prompt hint, the band and the shown pane', async () => {
    const { bridge, calls, published } = setup((body) =>
      body.subtype === 'ui_attach' ? { surfaces: [] } : { tree: hint(String(body.component)) }
    )
    bridge.start()
    await flush()
    bridge.observe({
      type: 'system',
      subtype: 'ui_panes',
      panes: [{ id: 'deck', title: 'Deck', plugin: 'deck', columns: 52, rows: 14 }],
      shown_id: 'deck'
    })
    await flush()
    expect(calls[0]).toEqual({
      subtype: 'ui_attach',
      surface: 'desktop',
      client_id: 'orca-s1',
      viewport: { columns: 100, rows: 40, isFullscreen: true }
    })
    expect(calls[1]).toMatchObject({
      subtype: 'ui_render',
      component: 'PromptHint',
      instance_id: 'prompt-hint',
      props: { isDraft: false, isWorking: false, hint: '' }
    })
    expect(calls[2]).toMatchObject({
      component: 'AbovePrompt',
      instance_id: 'above-prompt',
      props: { bodyColumns: 95, maxRows: 20, hasSurvey: false }
    })
    expect(calls[3]).toMatchObject({
      component: 'Pane',
      instance_id: 'deck',
      props: { bodyColumns: 96, placement: 'inline', scroll: { offset: 0, bodyRows: 12 } }
    })
    expect(published).toEqual([
      { promptHint: hint('PromptHint') },
      { band: hint('AbovePrompt') },
      {
        pane: {
          id: 'deck',
          title: 'Deck',
          plugin: 'deck',
          columns: 52,
          rows: 14,
          tree: hint('Pane')
        }
      }
    ])
    await bridge.act({
      kind: 'layout',
      columns: 160,
      rows: 50,
      placement: 'dock',
      paneColumns: 50,
      bandColumns: 103,
      isWorking: true,
      isDraft: false
    })
    await flush()
    expect(calls.find((call) => call.component === 'Pane' && call !== calls[3])).toMatchObject({
      viewport: { columns: 160, rows: 50 },
      props: { bodyColumns: 50, placement: 'dock', scroll: { bodyRows: 49 } }
    })
    await bridge.act({ kind: 'close', paneId: 'deck' })
    expect(calls.at(-1)).toEqual({ subtype: 'ui_close', id: 'deck', client_id: 'orca-s1' })
    bridge.observe({ type: 'system', subtype: 'ui_panes', panes: [], shown_id: null })
    await flush()
    expect(published.at(-1)).toEqual({ pane: null })
  })

  it('redraws each mounted site once for a burst of invalidations', async () => {
    const { bridge, calls } = setup((body) =>
      body.subtype === 'ui_attach' ? { surfaces: [] } : { tree: hint('x') }
    )
    bridge.start()
    await flush()
    const before = calls.length
    for (let i = 0; i < 4; i += 1) {
      bridge.observe({ type: 'system', subtype: 'ui_invalidate' })
    }
    await flush()
    expect(calls.slice(before).map((call) => call.component)).toEqual(['PromptHint', 'AbovePrompt'])
  })

  it('applies the drawing a press returns and redraws when it is not handled', async () => {
    const { bridge, calls, published } = setup((body) => {
      if (body.subtype === 'ui_attach') {
        return { surfaces: [] }
      }
      if (body.subtype === 'ui_press') {
        return { handled: true, drawn: { tree: hint('pressed') } }
      }
      return { tree: hint('hint') }
    })
    bridge.start()
    await flush()
    await bridge.act({
      kind: 'press',
      component: 'PromptHint',
      instanceId: 'prompt-hint',
      plugin: 'deck',
      handle: 3
    })
    expect(calls.find((call) => call.subtype === 'ui_press')).toMatchObject({
      plugin: 'deck',
      handle: 3,
      surface: 'desktop',
      client_id: 'orca-s1',
      render: { component: 'PromptHint', instance_id: 'prompt-hint' }
    })
    expect(published.at(-1)).toEqual({ promptHint: hint('pressed') })
  })

  it('stays silent and sends nothing more when ui_attach fails', async () => {
    const { bridge, calls, published } = setup((body) => {
      throw new Error(`no ${String(body.subtype)}`)
    })
    bridge.start()
    await flush()
    bridge.observe({
      type: 'system',
      subtype: 'ui_panes',
      panes: [{ id: 'deck', title: 'Deck', plugin: 'deck' }],
      shown_id: 'deck'
    })
    await flush()
    expect(calls).toHaveLength(1)
    expect(published).toEqual([])
  })
})

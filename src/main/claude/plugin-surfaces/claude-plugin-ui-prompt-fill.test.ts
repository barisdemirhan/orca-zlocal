import { describe, expect, it, vi } from 'vitest'
import { answerPluginPromptFill } from './claude-plugin-ui-prompt-fill'

describe('answerPluginPromptFill', () => {
  it('publishes one frame per accepted fill and refuses an unusable body', () => {
    const publish = vi.fn()
    expect(answerPluginPromptFill({ text: 'look at this', mode: 'append' }, publish)).toEqual({
      filled: true
    })
    expect(answerPluginPromptFill({ text: 'again' }, publish)).toEqual({ filled: true })
    expect(answerPluginPromptFill({ text: '' }, publish)).toEqual({ filled: false })
    expect(answerPluginPromptFill({ text: 'x', mode: 'bogus' }, publish)).toEqual({ filled: false })
    const [first, second] = publish.mock.calls.map(([update]) => update.promptFill)
    expect(first).toMatchObject({ text: 'look at this', mode: 'append' })
    expect(second).toMatchObject({ text: 'again', mode: 'replace' })
    expect(first.id).not.toBe(second.id)
    expect(publish).toHaveBeenCalledTimes(2)
  })
})

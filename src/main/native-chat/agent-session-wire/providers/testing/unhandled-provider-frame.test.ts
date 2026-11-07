import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { projectStructuredItemToNativeChat } from '../../../../../shared/agent-session/view/structured-agent-session-projection'
import { nativeChatCodexApiErrorSummary } from '../../../../../shared/native-chat/native-chat-provider-frame-summary'
import { unhandledProviderFrameJournalItem } from '../unhandled-provider-frame'

describe('unhandled provider frame journal fallback', () => {
  it('projects the captured Codex model error with a readable summary and its original payload', () => {
    const frames: { case: string; method: string; params: unknown }[] = readFileSync(
      join(__dirname, '../../../../codex/__fixtures__/codex-app-server-turn-endings.jsonl'),
      'utf8'
    )
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
    const frame = frames.find(
      (entry) => entry.case === '0.141.0-bad-model' && entry.method === 'error'
    )
    if (!frame) {
      throw new Error('Expected the captured Codex model error')
    }
    const journal = unhandledProviderFrameJournalItem(
      'codex',
      `notification:${frame.method}`,
      frame.params
    )
    if (!journal) {
      throw new Error('Expected the model error to be journaled')
    }
    const message = projectStructuredItemToNativeChat({
      itemId: 'model-error',
      revision: 1,
      sequence: 1,
      observedAt: 1,
      body: journal.body
    })
    const block = message?.blocks.find((candidate) => candidate.type === 'text')
    if (!block || block.type !== 'text') {
      throw new Error('Expected the model error text block')
    }
    expect(nativeChatCodexApiErrorSummary(block)).toBe(
      "The 'gpt-qa-nonexistent' model is not supported when using Codex with a ChatGPT account."
    )
    expect(block.tone).toBe('error')
    expect(block.providerFrame?.payload.head).toBe(JSON.stringify(frame.params))
  })

  it('keeps a compact label and bounds the expandable payload without dropping it', () => {
    const item = unhandledProviderFrameJournalItem(
      'future-provider',
      'notification:new/event',
      { body: 'abcdefghij' },
      { inlineHeadBytes: 8 }
    )

    expect(item).not.toBeNull()
    if (!item) {
      throw new Error('expected substantive provider frame')
    }
    expect(item.body).toMatchObject({
      kind: 'status',
      text: 'future-provider · notification:new/event',
      providerFrame: {
        provider: 'future-provider',
        kind: 'notification:new/event',
        payload: { byteLength: 21, truncated: true }
      }
    })
    expect(
      Buffer.byteLength(item.body.providerFrame?.payload.head ?? '', 'utf8')
    ).toBeLessThanOrEqual(8)
  })

  it('turns an unserializable message-shaped payload into an explicit visible value', () => {
    const cyclic: { warning?: unknown } = {}
    cyclic.warning = cyclic

    const item = unhandledProviderFrameJournalItem('codex', 'frame', cyclic)

    expect(item?.body.text).toBe('codex · frame')
    expect(item?.body.providerFrame?.payload.head).toContain('unserializable payload')
  })
})

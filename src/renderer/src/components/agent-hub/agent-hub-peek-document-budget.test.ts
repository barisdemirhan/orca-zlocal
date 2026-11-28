import { expect, it } from 'vitest'
import { canRenderAgentHubPeekDocument } from './agent-hub-peek-document-budget'

it.each(['\n', '\r\n', '\r'])(
  'accepts lockfiles and logs with many lines inside the byte budget using %j',
  (separator) => {
    const content = `package: resolved${separator}`.repeat(10_000)
    expect(canRenderAgentHubPeekDocument('text', content)).toBe(true)
  }
)

it('allows the maximum newline count within the existing size budget', () => {
  expect(canRenderAgentHubPeekDocument('text', '\n'.repeat(512 * 1024))).toBe(true)
  expect(canRenderAgentHubPeekDocument('text', '\n'.repeat(512 * 1024 + 1))).toBe(false)
})

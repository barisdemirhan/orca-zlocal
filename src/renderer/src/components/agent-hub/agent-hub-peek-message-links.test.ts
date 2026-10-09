/** @vitest-environment happy-dom */
import { expect, it, vi } from 'vitest'
import { makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'

vi.mock('@/store', () => ({
  useAppStore: { getState: () => ({ settings: { experimentalAgentHub: true } }) }
}))
vi.mock('@/lib/connection-context', () => ({ getConnectionIdForFile: () => null }))
vi.mock('@/lib/client-creation-action-policy', () => ({
  getClientCreationActionPolicy: () => ({ 'managed-browser': { state: 'enabled' } })
}))
vi.mock('@/lib/worktree-operation-route', () => ({
  resolveWorktreeOperationRoute: () => ({ executionHostId: 'local', runtimeEnvironmentId: null })
}))

import { agentHubPeekItemsInMessage } from './agent-hub-peek-message-links'

it('offers the pages and peekable files an agent message points to, once each', () => {
  const worktree = { ...makeWorktree(), path: '/Users/dev/projects/northwind' }
  const message = [
    'Storybook: http://127.0.0.1:6007, and again http://127.0.0.1:6007.',
    'Contact sheet: ~/Documents/Agents/Artifacts/northwind/contact-tr.png',
    'Changed src/app/main.ts and docs/review.pdf; see docs/review.pdf'
  ].join('\n')

  const items = agentHubPeekItemsInMessage(message, worktree)

  expect(items.map((item) => [item.content.kind, item.location])).toEqual([
    ['web', 'http://127.0.0.1:6007/'],
    ['image', '/Users/dev/Documents/Agents/Artifacts/northwind/contact-tr.png'],
    ['pdf', '/Users/dev/projects/northwind/docs/review.pdf']
  ])
})

/** @vitest-environment happy-dom */
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { useAppStore } from '@/store'
import type { Worktree } from '../../../../shared/worktree/types'
import { makeRepo, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'

vi.mock('@/store', async () => {
  const { createTestStore } = await import('@/store/slices/store-test-helpers')
  return { useAppStore: createTestStore() }
})
vi.mock('@/lib/client-creation-action-policy', () => ({
  getClientCreationActionPolicy: () => ({ 'managed-browser': { state: 'enabled' } })
}))

import { agentHubPeekItemsInMessage } from './agent-hub-peek-message-links'
import { AgentHubPeekChips } from './AgentHubPeekChips'

afterEach(cleanup)

it('explains unsupported file chips and keeps URL refusals unchanged', () => {
  const worktree = { ...makeWorktree(), hostId: 'local' as const }
  useAppStore.setState({ worktreesByRepo: { [worktree.repoId]: [worktree] } })
  render(
    createElement(AgentHubPeekChips, {
      text: '',
      worktree,
      links: ['./notes.md', 'ftp://example.com']
    })
  )
  expect(screen.getByRole('button', { name: 'Peek at ./notes.md' }).title).toBe(
    'Peek opens web pages, images, PDF, audio, video and HTML files. This file type is not supported.'
  )
  expect(screen.getByRole('button', { name: 'Peek at ftp://example.com' }).title).toBe(
    'This URL or file cannot be opened in Peek on its host.'
  )
})

it('offers the pages and peekable files an agent message points to, once each', () => {
  const worktree: Worktree = {
    ...makeWorktree(),
    id: 'repo-1::/Users/dev/projects/northwind',
    path: '/Users/dev/projects/northwind',
    hostId: 'local'
  }
  useAppStore.setState({
    repos: [makeRepo()],
    worktreesByRepo: { [worktree.repoId]: [worktree] }
  })
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

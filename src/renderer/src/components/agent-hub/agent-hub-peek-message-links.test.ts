/** @vitest-environment happy-dom */
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { useAppStore } from '@/store'
import type { Worktree } from '../../../../shared/worktree/types'
import { makeRepo, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'

vi.mock('@/store', async () => {
  const { createTestStore } = await import('@/store/testing/app-store-test-fixture')
  return { useAppStore: createTestStore() }
})
vi.mock('@/lib/client-creation-action-policy', () => ({
  getClientCreationActionPolicy: () => ({ 'managed-browser': { state: 'enabled' } })
}))

import { agentHubPeekItemsInMessage } from './agent-hub-peek-message-links'
import { AgentHubPeekChips } from './AgentHubPeekChips'
import { closeAgentHubPeek, readAgentHubPeek } from './agent-hub-peek-store'

afterEach(() => {
  cleanup()
  closeAgentHubPeek()
})

it('explains unsupported file chips and keeps URL refusals unchanged', () => {
  const worktree = { ...makeWorktree(), hostId: 'local' as const }
  useAppStore.setState({ worktreesByRepo: { [worktree.repoId]: [worktree] } })
  render(
    createElement(AgentHubPeekChips, {
      text: '',
      worktree,
      links: ['./archive.zip', 'ftp://example.com']
    })
  )
  expect(screen.getByRole('button', { name: 'Peek at ./archive.zip' }).title).toBe(
    'This file type cannot be shown in Peek. Open it in the workspace or default app.'
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
    'Changed src/app/main.ts and docs/review.pdf; see docs/review.pdf',
    'Read docs/report.md'
  ].join('\n')

  const items = agentHubPeekItemsInMessage(message, worktree)

  expect(items.map((item) => [item.content.kind, item.location])).toEqual([
    ['web', 'http://127.0.0.1:6007/'],
    ['image', '/Users/dev/Documents/Agents/Artifacts/northwind/contact-tr.png'],
    ['pdf', '/Users/dev/projects/northwind/docs/review.pdf'],
    ['markdown', '/Users/dev/projects/northwind/docs/report.md']
  ])
})

it('keeps previewable documents ahead of source files before limiting message chips', () => {
  const worktree: Worktree = { ...makeWorktree(), path: '/workspace', hostId: 'local' }
  useAppStore.setState({
    repos: [makeRepo()],
    worktreesByRepo: { [worktree.repoId]: [worktree] }
  })
  const items = agentHubPeekItemsInMessage(
    [
      'src/a.ts',
      'src/b.ts',
      'src/c.ts',
      'src/d.ts',
      'docs/image.png',
      'docs/report.pdf',
      'docs/notes.md',
      'docs/demo.html'
    ].join('\n'),
    worktree
  )
  expect(items.map((item) => item.location)).toEqual([
    '/workspace/docs/image.png',
    '/workspace/docs/report.pdf',
    '/workspace/docs/notes.md',
    '/workspace/docs/demo.html'
  ])
})

it.each([
  ['./notes.md', 'notes.md', 'markdown'],
  ['./notes.txt', 'notes.txt', 'text'],
  ['./main.ts', 'main.ts', 'text'],
  ['./data.csv', 'data.csv', 'csv'],
  ['./flow.mmd', 'flow.mmd', 'mermaid'],
  ['./analysis.ipynb', 'analysis.ipynb', 'notebook']
])('opens an enabled chip from %s', (link, title, kind) => {
  const worktree = { ...makeWorktree(), hostId: 'local' as const }
  useAppStore.setState({
    repos: [makeRepo()],
    worktreesByRepo: { [worktree.repoId]: [worktree] }
  })
  render(createElement(AgentHubPeekChips, { text: '', worktree, links: [link] }))
  const chip = screen.getByRole('button', { name: `Peek at ${title}` })
  expect(chip).not.toHaveProperty('disabled', true)
  fireEvent.click(chip)
  expect(readAgentHubPeek()?.history[0]?.content).toMatchObject({ kind })
})

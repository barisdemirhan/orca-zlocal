/** @vitest-environment happy-dom */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { readRuntimeFileContent } from '@/runtime/files/reads/runtime-file-read-client'
import { AgentHubPeekFile } from './AgentHubPeekFile'
import { canRenderAgentHubPeekDocument } from './agent-hub-peek-document-budget'
import type * as PeekDocumentBudgetModule from './agent-hub-peek-document-budget'

vi.mock('@/runtime/files/reads/runtime-file-read-client', () => ({
  readRuntimeFileContent: vi.fn()
}))
vi.mock('./AgentHubPeekDocument', () => ({
  AgentHubPeekDocument: ({ content }: { content: string }) => <pre>{content}</pre>
}))
vi.mock('./agent-hub-peek-document-budget', async (importOriginal) => {
  const actual = await importOriginal<typeof PeekDocumentBudgetModule>()
  return { ...actual, canRenderAgentHubPeekDocument: vi.fn(actual.canRenderAgentHubPeekDocument) }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('reuses document budget validation until the file content or kind changes', async () => {
  vi.mocked(readRuntimeFileContent).mockResolvedValue({ content: 'first report', isBinary: false })
  const props = { onContentSize: vi.fn(), onUnavailable: vi.fn() }
  const content = { kind: 'text' as const, filePath: '/workspace/report.txt', connectionId: null }
  const shown = render(<AgentHubPeekFile {...props} content={content} />)
  await screen.findByText('first report')
  expect(canRenderAgentHubPeekDocument).toHaveBeenCalledTimes(1)

  shown.rerender(<AgentHubPeekFile {...props} content={{ ...content, line: 2 }} />)
  expect(canRenderAgentHubPeekDocument).toHaveBeenCalledTimes(1)

  shown.rerender(<AgentHubPeekFile {...props} content={{ ...content, kind: 'csv' }} />)
  expect(canRenderAgentHubPeekDocument).toHaveBeenCalledTimes(2)

  vi.mocked(readRuntimeFileContent).mockResolvedValue({ content: 'second report', isBinary: false })
  shown.rerender(
    <AgentHubPeekFile
      {...props}
      content={{ ...content, kind: 'csv', filePath: '/workspace/next.csv' }}
    />
  )
  await screen.findByText('second report')
  await waitFor(() => expect(canRenderAgentHubPeekDocument).toHaveBeenCalledTimes(3))
  expect(props.onUnavailable).not.toHaveBeenCalled()
})

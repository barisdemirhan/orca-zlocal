/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { createGlobalSettingsFixture } from '../../../../shared/global-settings-test-fixture'
import { readRuntimeFileContent } from '@/runtime/files/reads/runtime-file-read-client'
import type { AgentHubPeekContent } from './agent-hub-peek-store'
import { AgentHubPeekFile } from './AgentHubPeekFile'

const monacoEditor = vi.hoisted(() => ({
  setTheme: vi.fn(),
  colorize: vi.fn(async () => ''),
  create: vi.fn(),
  createModel: vi.fn()
}))
vi.mock('@/lib/editor/monaco/monaco-setup', () => ({ monaco: { editor: monacoEditor } }))
vi.mock('@/runtime/files/reads/runtime-file-read-client', () => ({
  readRuntimeFileContent: vi.fn()
}))
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async () => ({
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>QA diagram</text></svg>'
    }))
  }
}))

const initial = useAppStore.getState()
const readFile = vi.mocked(readRuntimeFileContent)
const notebook = JSON.stringify({
  metadata: { language_info: { name: 'python' } },
  cells: [
    { cell_type: 'markdown', source: '# Saved report' },
    {
      cell_type: 'code',
      source: 'print("saved result")',
      execution_count: 7,
      outputs: [
        { output_type: 'stream', name: 'stdout', text: 'saved result' },
        {
          output_type: 'display_data',
          data: { 'text/html': '<script>alert(1)</script><b>safe</b>' }
        }
      ]
    }
  ]
})
type FileKind = Extract<AgentHubPeekContent, { filePath: string }>['kind']

function showFile(
  kind: FileKind,
  content: string,
  filePath = '/workspace/preview.txt',
  location: { line?: number; column?: number } = {}
) {
  readFile.mockResolvedValue({ content, isBinary: false })
  const onUnavailable = vi.fn()
  const onContentSize = vi.fn()
  const result = render(
    <AgentHubPeekFile
      content={{ kind, filePath, connectionId: null, ...location }}
      onContentSize={onContentSize}
      onUnavailable={onUnavailable}
    />
  )
  return { ...result, onUnavailable, onContentSize }
}

beforeEach(() => {
  useAppStore.setState({ ...initial, settings: createGlobalSettingsFixture() })
  readFile.mockReset()
  monacoEditor.colorize.mockResolvedValue('')
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { fs: { writeFile: vi.fn() }, notebook: { startKernel: vi.fn(), execute: vi.fn() } }
  })
})
afterEach(() => {
  cleanup()
  useAppStore.setState(initial)
  vi.clearAllMocks()
})

describe('read-only Peek documents', () => {
  it.each([
    [120, 120],
    [999, 160]
  ])(
    'scrolls to and highlights line %i, clamping to the document at %i',
    async (line, expected) => {
      const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView')
      try {
        const content = Array.from(
          { length: 160 },
          (_, index) => `const line${index + 1} = true`
        ).join('\n')
        showFile('text', content, '/workspace/main.ts', { line, column: 5 })
        const target = await screen.findByText(
          `const line${expected} = true`,
          {},
          { timeout: 10000 }
        )
        await waitFor(() => expect(scroll.mock.contexts).toContain(target.parentElement))
      } finally {
        scroll.mockRestore()
      }
    }
  )

  it('keeps code visible when a syntax tokenizer cannot load', async () => {
    monacoEditor.colorize.mockRejectedValueOnce(new Error('Tokenizer unavailable'))
    const shown = showFile('text', 'const readable = true', '/workspace/main.ts')
    await screen.findByText('const readable = true')
    await waitFor(() => expect(monacoEditor.colorize).toHaveBeenCalled())
    expect(shown.onUnavailable).not.toHaveBeenCalled()
  })
  it('shows code as numbered literal lines without creating a model, draft, or stealing input focus', async () => {
    const draft = document.createElement('textarea')
    draft.value = 'keep this reply'
    document.body.append(draft)
    draft.focus()
    const openFiles = useAppStore.getState().openFiles
    const shown = showFile(
      'text',
      'const value = "<script>run()</script>"\nconsole.log(value)',
      '/workspace/main.ts'
    )
    await screen.findByText('console.log(value)')
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(shown.container.querySelector('script')).toBeNull()
    expect(document.activeElement).toBe(draft)
    expect(draft.value).toBe('keep this reply')
    fireEvent.keyDown(shown.container, { key: 's', ctrlKey: true })
    expect(monacoEditor.create).not.toHaveBeenCalled()
    expect(monacoEditor.createModel).not.toHaveBeenCalled()
    expect(window.api.fs.writeFile).not.toHaveBeenCalled()
    expect(useAppStore.getState().openFiles).toBe(openFiles)
    expect(shown.onContentSize).toHaveBeenCalledWith(null)
    expect(shown.onUnavailable).not.toHaveBeenCalled()
    draft.remove()
  })

  it.each([
    ['/workspace/data.csv', 'name,value\nA,1\nB,2', 'Comma'],
    ['/workspace/data.tsv', 'name\tvalue\nA\t1\nB\t2', 'Tab']
  ])(
    'uses a read-only table with the correct delimiter for %s',
    async (filePath, content, delimiter) => {
      const shown = showFile('csv', content, filePath)
      await screen.findByText('2 rows', {}, { timeout: 10000 })
      expect(screen.getByText('2 columns')).toBeTruthy()
      expect(screen.getByRole('combobox').textContent).toContain(delimiter)
      fireEvent.doubleClick(shown.container)
      fireEvent.keyDown(shown.container, { key: 'Enter' })
      expect(shown.container.querySelector('textarea,input,[contenteditable="true"]')).toBeNull()
      expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
      expect(window.api.fs.writeFile).not.toHaveBeenCalled()
      expect(shown.onUnavailable).not.toHaveBeenCalled()
    }
  )

  it('shows saved notebook cells and sanitized outputs without edit or execution controls', async () => {
    const shown = showFile('notebook', notebook, '/workspace/report.ipynb')
    // Lazy viewers can take several seconds to import under background scheduling.
    await screen.findByRole('heading', { name: 'Saved report' }, { timeout: 10000 })
    expect(screen.getByText('print("saved result")')).toBeTruthy()
    expect(screen.getByText('saved result')).toBeTruthy()
    const output = screen.getByTitle('Notebook HTML output')
    expect(output.getAttribute('sandbox')).toBe('')
    expect(output.getAttribute('srcdoc')).toContain('<b>safe</b>')
    expect(output.getAttribute('srcdoc')).not.toContain('<script>')
    fireEvent.doubleClick(screen.getByText('print("saved result")'))
    fireEvent.keyDown(shown.container, { key: 'Enter', shiftKey: true })
    fireEvent.keyDown(shown.container, { key: 'Enter', ctrlKey: true })
    expect(shown.container.querySelector('textarea,input,[contenteditable="true"]')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(monacoEditor.create).not.toHaveBeenCalled()
    expect(window.api.notebook.startKernel).not.toHaveBeenCalled()
    expect(window.api.notebook.execute).not.toHaveBeenCalled()
    expect(window.api.fs.writeFile).not.toHaveBeenCalled()
    expect(shown.onContentSize).toHaveBeenCalledWith(null)
    expect(shown.onUnavailable).not.toHaveBeenCalled()
  })

  it('contains a malformed notebook in Peek instead of unmounting the surrounding UI', async () => {
    const shown = showFile('notebook', '{"cells":false}', '/workspace/bad.ipynb')
    expect((await screen.findByRole('alert', {}, { timeout: 10000 })).textContent).toContain(
      'Unable to render notebook'
    )
    expect(shown.onUnavailable).not.toHaveBeenCalled()
  })

  it('renders a diagram through the existing sanitized Mermaid viewer', async () => {
    const shown = showFile('mermaid', 'graph TD; A-->B', '/workspace/flow.mmd')
    await screen.findByText('QA diagram')
    expect(shown.container.querySelector('.mermaid-block')?.textContent).toBe('QA diagram')
    expect(shown.onContentSize).toHaveBeenCalledWith(null)
    expect(shown.onUnavailable).not.toHaveBeenCalled()
  })

  it.each([
    ['text', `${'x'.repeat(1000)}\n`.repeat(600)],
    ['text', 'x'.repeat(20001)],
    ['csv', 'x'.repeat(512 * 1024 + 1)],
    [
      'notebook',
      JSON.stringify({
        cells: Array.from({ length: 251 }, () => ({ cell_type: 'raw', source: '' }))
      })
    ],
    ['notebook', JSON.stringify({ cells: [{ cell_type: 'code', source: '\n'.repeat(200) }] })]
  ] as const)(
    'falls back once for an oversized %s document without partial rendering',
    async (kind, content) => {
      const shown = showFile(kind, content)
      await waitFor(() => expect(shown.onUnavailable).toHaveBeenCalledTimes(1))
      expect(monacoEditor.colorize).not.toHaveBeenCalled()
      expect(shown.onContentSize).toHaveBeenCalledWith(null)
    }
  )

  it('rejects a code filename whose owner returned binary bytes', async () => {
    readFile.mockResolvedValue({ content: 'base64', isBinary: true })
    const unavailable = vi.fn()
    render(
      <AgentHubPeekFile
        content={{ kind: 'text', filePath: '/workspace/false.ts', connectionId: null }}
        onContentSize={vi.fn()}
        onUnavailable={unavailable}
      />
    )
    await waitFor(() => expect(unavailable).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('base64')).toBeNull()
    expect(monacoEditor.colorize).not.toHaveBeenCalled()
  })
})

/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { HubReplyField } from './AgentHubAnswerBody'

vi.mock('@/store', () => ({
  useAppStore: (select: (state: { settings: null }) => unknown) => select({ settings: null })
}))

beforeEach(() => {
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = (): string => 'blob:preview'
      static revokeObjectURL = vi.fn()
    }
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function submit(input: HTMLElement): void {
  const form = input.closest('form')
  if (!form) {
    throw new Error('expected the reply form')
  }
  fireEvent.submit(form)
}

function paste(input: HTMLElement, { image, text }: { image: boolean; text: string }): void {
  fireEvent.paste(input, {
    clipboardData: {
      files: image ? [new File(['png'], 'shot.png', { type: 'image/png' })] : [],
      getData: () => text
    }
  })
}

it('attaches a pasted image where the agent runs and sends its path with the reply', async () => {
  const onSend = vi.fn()
  const onPasteImage = vi.fn(async () => '/tmp/orca-paste-1.png')
  render(
    <HubReplyField
      placeholder="Reply"
      disabled={false}
      onSend={onSend}
      onPasteImage={onPasteImage}
    />
  )
  const input = screen.getByRole('textbox', { name: 'Reply' })

  await act(async () => paste(input, { image: true, text: '' }))
  expect(screen.getByText('Image 1')).toBeTruthy()

  fireEvent.change(input, { target: { value: 'see this' } })
  submit(input)
  expect(onSend).toHaveBeenCalledWith('see this /tmp/orca-paste-1.png')
  expect(screen.queryByText('Image 1')).toBeNull()
})

it('sends an image on its own, and leaves a paste with text to the field', async () => {
  const onSend = vi.fn()
  const onPasteImage = vi.fn(async () => '/tmp/orca-paste-2.png')
  render(
    <HubReplyField
      placeholder="Reply"
      disabled={false}
      onSend={onSend}
      onPasteImage={onPasteImage}
    />
  )
  const input = screen.getByRole('textbox', { name: 'Reply' })

  await act(async () => paste(input, { image: true, text: 'a copied page' }))
  expect(onPasteImage).not.toHaveBeenCalled()

  await act(async () => paste(input, { image: true, text: '' }))
  submit(input)
  expect(onSend).toHaveBeenCalledWith('/tmp/orca-paste-2.png')
})

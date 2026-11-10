// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { NativeChatQuestionCard } from '../native-chat/prompts/NativeChatQuestionCard'
import { NativeChatOrbPromptSlot } from '../native-chat/NativeChatOrbPromptSlot'
import { AgentHubOrbRequestModal } from './AgentHubOrbRequestModal'
import {
  closeAgentHubOrbPanel,
  showAgentHubOrbPanel,
  useAgentHubOrbPanel
} from './agent-hub-orb-panel-store'

afterEach(() => {
  cleanup()
  closeAgentHubOrbPanel()
})

it('keeps the same multi-question answer and step when the modal is deferred and reopened', async () => {
  showAgentHubOrbPanel({ sessionId: 'orb', tabId: 'tab', resumed: false })
  const answer = vi.fn()
  const cancel = vi.fn()
  function Host() {
    const pending = useAgentHubOrbPanel((s) => s.nativeRequestPending)
    return (
      <TooltipProvider>
        <AgentHubOrbRequestModal pending={pending} requestKey="question" />
        <NativeChatOrbPromptSlot sessionId="orb" tabId="tab" pending requestId="question">
          <NativeChatQuestionCard
            prompt={{
              questions: [
                {
                  header: 'Period',
                  question: 'Which period?',
                  multiSelect: false,
                  options: [{ label: 'Monthly' }]
                },
                {
                  header: 'Details',
                  question: 'Describe the measurement',
                  multiSelect: false,
                  options: []
                }
              ]
            }}
            onAnswer={answer}
            onCancel={cancel}
          />
        </NativeChatOrbPromptSlot>
      </TooltipProvider>
    )
  }
  render(<Host />)
  const modal = await screen.findByRole('dialog')
  expect(within(modal).getByText('Which period?')).toBeTruthy()
  fireEvent.click(within(modal).getByRole('button', { name: 'Details' }))
  const input = within(modal).getByRole('textbox')
  fireEvent.change(input, { target: { value: 'A detailed measurement. '.repeat(30) } })
  fireEvent.click(within(modal).getByRole('button', { name: 'Answer later' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(answer).not.toHaveBeenCalled()
  expect(cancel).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Waiting for your answer' }))
  const reopened = await screen.findByRole('dialog')
  expect(within(reopened).getByText('Describe the measurement')).toBeTruthy()
  expect(within(reopened).getByRole('textbox')).toBe(input)
  expect(input).toHaveProperty('value', 'A detailed measurement. '.repeat(30))
  act(() => closeAgentHubOrbPanel())
})

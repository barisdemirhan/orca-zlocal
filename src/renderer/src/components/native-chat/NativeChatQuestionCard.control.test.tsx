// @vitest-environment happy-dom

import { act, createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NativeChatQuestionCard,
  type NativeChatQuestionCardControl
} from './prompts/NativeChatQuestionCard'
import type { AskAnswerSelection } from '../../../../shared/native-chat/input/questions/native-chat-ask-answer'
import type { AskPrompt } from '../../../../shared/native-chat/input/questions/native-chat-ask-types'

// The Agent Hub answers with number keys through controlRef; these pin that a digit
// behaves like the agent's own selector: pick-and-submit for single select, toggle otherwise.

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function render(
  prompt: AskPrompt,
  onAnswer: (selections: AskAnswerSelection[]) => void,
  props: { highlightRecommended?: boolean } = {}
): React.RefObject<NativeChatQuestionCardControl | null> {
  const controlRef = createRef<NativeChatQuestionCardControl>()
  act(() => {
    root.render(
      <NativeChatQuestionCard
        prompt={prompt}
        onAnswer={onAnswer}
        onCancel={() => {}}
        controlRef={controlRef}
        {...props}
      />
    )
  })
  return controlRef
}

function choose(
  controlRef: React.RefObject<NativeChatQuestionCardControl | null>,
  index: number
): boolean {
  let handled = false
  act(() => {
    handled = controlRef.current?.chooseOption(index) ?? false
  })
  return handled
}

const singleSelect: AskPrompt = {
  questions: [
    {
      question: 'Which provider?',
      multiSelect: false,
      options: [{ label: 'Meta Cloud API (Recommended)' }, { label: 'Twilio' }]
    }
  ]
}

describe('NativeChatQuestionCard number-key control', () => {
  it('submits a single-select question with the chosen option index', () => {
    const onAnswer = vi.fn()
    const controlRef = render(singleSelect, onAnswer)

    expect(choose(controlRef, 1)).toBe(true)
    expect(onAnswer).toHaveBeenCalledWith([{ indices: [1], other: '' }])
  })

  it('ignores a number with no matching option', () => {
    const onAnswer = vi.fn()
    const controlRef = render(singleSelect, onAnswer)

    expect(choose(controlRef, 5)).toBe(false)
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('toggles multi-select options without submitting', () => {
    const onAnswer = vi.fn()
    const controlRef = render(
      {
        questions: [
          {
            question: 'Which checks?',
            multiSelect: true,
            options: [{ label: 'Lint' }, { label: 'Tests' }]
          }
        ]
      },
      onAnswer
    )

    expect(choose(controlRef, 0)).toBe(true)
    expect(onAnswer).not.toHaveBeenCalled()
    const pressed = [...container.querySelectorAll('button[aria-pressed="true"]')]
    expect(pressed.map((button) => button.textContent)).toEqual(['Lint'])
  })

  it('advances a multi-question prompt and submits on the last answer', () => {
    const onAnswer = vi.fn()
    const controlRef = render(
      {
        questions: [
          { question: 'First?', multiSelect: false, options: [{ label: 'A' }, { label: 'B' }] },
          { question: 'Second?', multiSelect: false, options: [{ label: 'C' }, { label: 'D' }] }
        ]
      },
      onAnswer
    )

    choose(controlRef, 1)
    expect(onAnswer).not.toHaveBeenCalled()
    choose(controlRef, 0)
    expect(onAnswer).toHaveBeenCalledWith([
      { indices: [1], other: '' },
      { indices: [0], other: '' }
    ])
  })
})

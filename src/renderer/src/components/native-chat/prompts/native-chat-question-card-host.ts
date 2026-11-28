import type { ReactNode, Ref, RefObject } from 'react'

export type NativeChatQuestionCardControl = {
  /** Number-key answer: picks an option; a single-select pick also advances or submits. */
  chooseOption: (optionIndex: number) => boolean
}

/** What a host that embeds the card (the Agent Hub) adds to the chat's own props. */
export type NativeChatQuestionCardHostProps = {
  /** The multiline free-text field, for hosts whose answerAccessory targets it. */
  answerTextareaRef?: RefObject<HTMLTextAreaElement | null>
  /** Rendered inside the free-text row, after the field (e.g. a dictation mic). */
  answerAccessory?: ReactNode
  /** 'embedded' drops the composer-docking chrome for hosts that frame the card themselves. */
  layout?: 'composer' | 'embedded'
  controlRef?: Ref<NativeChatQuestionCardControl>
}

import { nativeChatAskDismissKey } from '../../../../../shared/native-chat/input/questions/native-chat-ask-dismiss-key'
import {
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type Ref
} from 'react'
import type { InteractivePromptCard } from '../../../../../shared/native-chat/input/native-chat-interactive-prompt'
import {
  NativeChatQuestionCard,
  type NativeChatQuestionCardControl
} from './NativeChatQuestionCard'
import { NativeChatApprovalCard } from './NativeChatApprovalCard'
import type { NativeChatInteractiveSend } from '../session/terminal/send/use-native-chat-interactive-send'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'

export type NativeChatInteractiveCardControl = NativeChatQuestionCardControl

/**
 * Render one prompt occurrence the view chose (see useNativeChatPromptCardPresentation): a
 * question wizard or a tool approval, in the composer's place. Sends through the composer's
 * verified runtime path (R8/R6): answers via agent-specific paste or selector keystrokes;
 * cancel/deny as ESC. Unmount normally cancels scheduled writes and always ignores late results.
 *
 * The card hides (`onDismiss`) only once its answer was delivered: a refused or unconfirmed
 * answer keeps the choices up, so the user can answer again here or in the terminal.
 */
export function NativeChatInteractiveCard({
  card,
  send,
  onDismiss,
  onCollapse,
  requiresTerminal = false,
  onAnswerInTerminal,
  shouldFocus = false,
  answerInputRef,
  answerTextareaRef,
  answerAccessory,
  layout,
  highlightRecommended,
  controlRef,
  finishAnswerAfterUnmount = false
}: {
  card: NonNullable<InteractivePromptCard>
  send: NativeChatInteractiveSend
  /** Hide this occurrence after its answer write was acknowledged. */
  onDismiss: () => void
  /** Fold this occurrence to a strip above the composer, writing nothing. */
  onCollapse?: () => void
  requiresTerminal?: boolean
  onAnswerInTerminal?: () => void
  /** Take focus when the card takes the input region from the composer. */
  shouldFocus?: boolean
  /** Paste target while the prompt card replaces the composer. */
  answerInputRef?: React.RefObject<HTMLTextAreaElement | null>
  /** Forwarded to the question card's multiline free-text field. */
  answerTextareaRef?: React.RefObject<HTMLTextAreaElement | null>
  /** Forwarded to the question card's free-text row. */
  answerAccessory?: React.ReactNode
  layout?: 'composer' | 'embedded'
  highlightRecommended?: boolean
  /** Number-key answers: option N of a question, or approval choice N. */
  controlRef?: Ref<NativeChatInteractiveCardControl>
  /** The sender owns delivery after this short-lived card leaves. */
  finishAnswerAfterUnmount?: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const { sendAnswer, sendRawVerified, cancelPending, cancelAsk } = send
  // A question answer is a paced multi-step write (body→Enter per question); keep
  // the card up until it settles instead of dismissing on the click, so it doesn't
  // vanish mid-send. `submitting` also gates a second submit racing the first.
  const submittingRef = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  const activeRef = useRef(true)
  const attemptRef = useRef(0)
  const cancellingRef = useRef(false)
  const [cancelling, setCancelling] = useState(false)
  const settle = useCallback((): void => {
    submittingRef.current = false
    setSubmitting(false)
    cancellingRef.current = false
    setCancelling(false)
  }, [])
  // Retire callbacks during commit; an already-issued write may still settle later.
  useLayoutEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
      attemptRef.current += 1
      if (!finishAnswerAfterUnmount) {
        cancelPending()
      }
    }
  }, [cancelPending, finishAnswerAfterUnmount])

  const choose = (raw: string): void => {
    if (submittingRef.current) {
      return
    }
    submittingRef.current = true
    const attempt = ++attemptRef.current
    setSubmitting(true)
    const startupDialog = card.kind === 'approval' ? card.approval.startupDialog : undefined
    void sendRawVerified(raw, startupDialog)
      .catch(() => false)
      .then((delivered) => {
        if (!activeRef.current || attempt !== attemptRef.current) {
          return
        }
        // The dialog stays up until its status settles; keep the lock so no message types into it.
        if (delivered && startupDialog) {
          return
        }
        settle()
        if (delivered) {
          onDismiss()
        }
      })
  }
  const questionControlRef = useRef<NativeChatQuestionCardControl>(null)
  useImperativeHandle(controlRef, () => ({
    chooseOption: (index: number): boolean => {
      if (card.kind === 'question') {
        return questionControlRef.current?.chooseOption(index) ?? false
      }
      const option = card.approval.options[index]
      if (!option || submittingRef.current) {
        return false
      }
      choose(option.send)
      return true
    }
  }))

  if (card.kind === 'question') {
    if (requiresTerminal) {
      return (
        <div className="shrink-0 bg-chat-pane">
          <div className="mx-auto w-full max-w-(--chat-content-max-width) px-3 pt-2 pb-4 sm:px-4">
            <div className="rounded-lg border border-input bg-card p-3 shadow-xs">
              <p className="text-sm text-foreground">
                {t(
                  'components.native-chat.question.terminalRequired',
                  'Answer this OMP question in the terminal.'
                )}
              </p>
              <Button
                className="mt-3"
                size="sm"
                disabled={!onAnswerInTerminal}
                onClick={onAnswerInTerminal}
              >
                {t('components.native-chat.question.openTerminal', 'Answer in terminal')}
              </Button>
            </div>
          </div>
        </div>
      )
    }
    return (
      <NativeChatQuestionCard
        key={nativeChatAskDismissKey(card.prompt)}
        prompt={card.prompt}
        isSubmitting={submitting}
        isCancelling={cancelling}
        answerInputRef={answerInputRef}
        answerTextareaRef={answerTextareaRef}
        answerAccessory={answerAccessory}
        layout={layout}
        highlightRecommended={highlightRecommended}
        controlRef={questionControlRef}
        onAnswer={(selections) => {
          if (submittingRef.current) {
            return
          }
          submittingRef.current = true
          const attempt = ++attemptRef.current
          const result = sendAnswer(card.prompt, selections, (delivered) => {
            if (!activeRef.current || attempt !== attemptRef.current) {
              return
            }
            settle()
            if (delivered) {
              onDismiss()
            }
          })
          if (result.settleAfterMs <= 0) {
            // Keep the card retryable if its PTY disappeared before submission.
            settle()
            return
          }
          setSubmitting(true)
        }}
        onCollapse={onCollapse}
        shouldFocus={shouldFocus}
        onCancel={() => {
          if (card.prompt.replyAsMessage) {
            // The agent is not waiting on this card, and Escape would interrupt its turn.
            onDismiss()
            return
          }
          if (cancellingRef.current) {
            return
          }
          settle()
          const attempt = ++attemptRef.current
          cancellingRef.current = true
          setCancelling(true)
          submittingRef.current = true
          setSubmitting(true)
          void cancelAsk()
            .catch(() => false)
            .then((delivered) => {
              if (!activeRef.current || attempt !== attemptRef.current) {
                return
              }
              settle()
              if (delivered) {
                onDismiss()
              }
            })
        }}
      />
    )
  }
  return (
    <NativeChatApprovalCard
      approval={card.approval}
      layout={layout}
      shouldFocus={shouldFocus}
      isSubmitting={submitting}
      onChoose={choose}
      onCollapse={onCollapse}
      onOpenTerminal={onAnswerInTerminal}
      parsedFromTerminal
    />
  )
}

import { cn } from '@/lib/class-names'
import { NativeChatQuestionText } from './NativeChatQuestionText'
import type { NativeChatQuestionCardLook } from './NativeChatQuestionCardParts'

export function NativeChatQuestionHeading({
  question,
  look
}: {
  question: string
  look: NativeChatQuestionCardLook | undefined
}): React.JSX.Element {
  return (
    <div
      // The fit keeps four lines of the question (or all of a shorter one) in view.
      data-native-chat-dock-floor-lines={4}
      className={cn(
        // The card's heading, one step above its body text and scaling with it; it fades while more lies below.
        'native-chat-question-card-question min-h-[1lh] shrink overflow-y-auto px-3.5 text-[length:calc(var(--text-sm)*15/13)] leading-snug font-semibold text-foreground scrollbar-sleek',
        // Capped at whole lines plus its own top padding, so a long question never shows a cut line.
        'max-h-[calc(8lh+var(--spacing)*3)] pt-3',
        // In a scrolling body the whole question scrolls with the options, never in a box of its own.
        '[[data-native-chat-dock-fit~=card]_&]:max-h-none [[data-native-chat-dock-fit~=card]_&]:shrink-0 [[data-native-chat-dock-fit~=card]_&]:overflow-visible'
      )}
    >
      <div data-native-chat-dock-content>
        {look?.renderQuestion ? (
          <div data-testid="native-chat-question-card-title">{look.renderQuestion(question)}</div>
        ) : (
          <NativeChatQuestionText
            data-testid="native-chat-question-card-title"
            content={question}
            className="break-words [&_p]:my-0 [&_p+p]:mt-2"
          />
        )}
      </div>
    </div>
  )
}

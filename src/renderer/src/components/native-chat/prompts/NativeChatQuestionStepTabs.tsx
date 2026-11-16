import { Check } from 'lucide-react'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import type { AskPrompt } from '../../../../../shared/native-chat/input/questions/native-chat-ask-types'

export function NativeChatQuestionStepTabs({
  questions,
  index,
  disabled,
  isAnswered,
  onGoTo
}: {
  questions: AskPrompt['questions']
  index: number
  disabled: boolean
  isAnswered: (index: number) => boolean
  onGoTo: (index: number) => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <div className="mb-2 flex gap-1 overflow-x-auto pb-1 scrollbar-sleek">
      {questions.map((qq, i) => (
        <button
          key={i}
          type="button"
          data-native-chat-question-step
          disabled={disabled}
          onClick={() => onGoTo(i)}
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium disabled:pointer-events-none',
            i === index
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span className="max-w-[10rem] truncate">
            {qq.header ||
              t('components.native-chat.question.step', 'Step {{value0}}', {
                value0: i + 1
              })}
          </span>
          {isAnswered(i) ? <Check className="size-3 text-primary" strokeWidth={3} /> : null}
        </button>
      ))}
    </div>
  )
}

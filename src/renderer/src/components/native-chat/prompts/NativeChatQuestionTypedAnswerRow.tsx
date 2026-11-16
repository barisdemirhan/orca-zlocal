import { Check, Pencil } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import { cn } from '@/lib/class-names'
import { ImeTextarea } from '@/lib/text-input/ime/ime-text-field'

const LINE_BREAKS = /[\r\n\u2028\u2029]/g

export function NativeChatQuestionTypedAnswerRow({
  multiline,
  expanded,
  chosen,
  disabled,
  value,
  placeholder,
  multilineRef,
  singleLineRef,
  focusTarget,
  accessory,
  onChange,
  onFieldClick,
  onSelectTyped,
  onEnter
}: {
  multiline: boolean
  expanded: boolean
  chosen: boolean
  disabled: boolean
  value: string | undefined
  placeholder: string
  multilineRef: RefObject<HTMLTextAreaElement | null> | undefined
  singleLineRef: RefObject<HTMLTextAreaElement | null> | undefined
  focusTarget: true | undefined
  accessory: ReactNode
  onChange: (value: string) => void
  onFieldClick: () => void
  onSelectTyped: () => void
  onEnter: () => void
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex min-h-9 min-w-0 flex-1 gap-3 rounded-[10px] border border-question-option-border px-2.5 py-1.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-chat-focus-ring',
        multiline ? 'items-start' : 'items-center',
        expanded && 'basis-full'
      )}
    >
      <span
        className={cn(
          'flex size-5.5 shrink-0 items-center justify-center rounded-md border',
          chosen
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-question-option-border text-muted-foreground'
        )}
      >
        {chosen ? <Check className="size-3.5" strokeWidth={3} /> : <Pencil className="size-3.5" />}
      </span>
      {/* Deliver free text verbatim as a tool result; composer slash commands and autocomplete do not apply. */}
      {multiline ? (
        // The box draws the field's edge, so the bare field (not the bordered Textarea primitive) sits inside it.
        <ImeTextarea
          ref={multilineRef}
          data-native-chat-answer-field
          data-native-chat-prompt-card-focus-target={focusTarget}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={onFieldClick}
          placeholder={placeholder}
          className={cn(
            'scrollbar-sleek max-h-[12lh] min-h-16 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent [field-sizing:content] text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-default disabled:opacity-50',
            expanded && 'min-h-[8lh]'
          )}
        />
      ) : (
        <ImeTextarea
          ref={singleLineRef}
          rows={1}
          data-native-chat-answer-field
          data-native-chat-prompt-card-focus-target={focusTarget}
          disabled={disabled}
          value={value}
          // Enter submits, so a line break becomes a space; edit in place so a mid-draft paste keeps the caret.
          onChange={(e) => {
            const field = e.target
            const oneLine = field.value.replace(LINE_BREAKS, ' ')
            if (oneLine !== field.value) {
              const { selectionStart, selectionEnd } = field
              field.value = oneLine
              field.setSelectionRange(selectionStart, selectionEnd)
            }
            onChange(oneLine)
          }}
          // Select typed text on click; tabbing toward Submit must not replace a picked option.
          onClick={() => {
            onFieldClick()
            if ((value ?? '').trim().length > 0) {
              onSelectTyped()
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onEnter()
            }
          }}
          placeholder={placeholder}
          className={cn(
            'scrollbar-sleek max-h-[6lh] min-w-0 flex-1 resize-none overflow-y-auto bg-transparent text-sm outline-none [field-sizing:content] placeholder:text-muted-foreground disabled:cursor-default disabled:opacity-50',
            chosen || !value ? 'text-foreground' : 'text-muted-foreground'
          )}
        />
      )}
      {accessory}
    </div>
  )
}

import { Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { splitRecommendedOptionLabel } from './native-chat-option-label'

export function NativeChatQuestionOptionRow({
  badge,
  initialFocus,
  label: rawLabel,
  highlightRecommended,
  description,
  selected,
  disabled,
  onSelect
}: {
  badge: string
  initialFocus: boolean
  label: string
  highlightRecommended: boolean
  description?: string
  selected: boolean
  disabled: boolean
  onSelect: () => void
}): React.JSX.Element {
  const { label, recommended } = highlightRecommended
    ? splitRecommendedOptionLabel(rawLabel)
    : { label: rawLabel, recommended: false }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      // Selection is otherwise only the visual check/badge swap; expose it to
      // assistive tech.
      aria-pressed={selected}
      data-native-chat-prompt-card-focus-target={initialFocus || undefined}
      className={cn(
        'group/option flex w-full items-start gap-3 px-3.5 py-2.5 text-left text-foreground transition-colors focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none',
        selected
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-medium',
          selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        )}
      >
        {selected ? <Check className="size-3.5" strokeWidth={3} /> : badge}
      </span>
      <span className="min-w-0">
        <span className="block break-words text-sm">
          {label}
          {recommended ? (
            <Badge variant="secondary" className="ml-2 align-middle">
              {translate('components.native-chat.question.recommended', 'Recommended')}
            </Badge>
          ) : null}
        </span>
        {description ? (
          <span
            className={cn(
              'block break-words text-xs',
              selected
                ? 'text-accent-foreground'
                : 'text-muted-foreground group-hover/option:text-accent-foreground group-focus/option:text-accent-foreground'
            )}
          >
            {description}
          </span>
        ) : null}
      </span>
    </button>
  )
}

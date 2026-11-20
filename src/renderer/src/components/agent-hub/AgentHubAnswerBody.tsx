import { Button } from '@/components/ui/button'
import { useEffect, useRef, useState } from 'react'
import { SendHorizontal, ShieldQuestion, Square, SquareCheck, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { AgentHubAnswerOption } from './agent-hub-answer-options'
import { HubChip } from './AgentHubInlineLabels'
import { HubDictateButton } from './AgentHubDictateButton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'

export type { AgentHubAnswerOption } from './agent-hub-answer-options'
export { questionOptions } from './agent-hub-answer-options'

/** How tightly an option list sits: the hub card, a pane's corner card, or a bubble's chips. */
export type HubOptionDensity = 'card' | 'compact' | 'chip'

const LIST_CLASS: Record<HubOptionDensity, string> = {
  card: '',
  compact: 'flex flex-col',
  chip: 'flex flex-wrap gap-1'
}

const OPTION_CLASS: Record<HubOptionDensity, string> = {
  card: 'group/opt mt-1.5 flex w-full items-center gap-2.5 rounded-lg border border-foreground/[0.06] bg-muted px-2.5 py-2.5 text-left text-[13px] text-foreground/85 transition-colors hover:border-foreground/15 hover:bg-accent/60 hover:text-foreground disabled:cursor-default data-[chosen=true]:border-agent-question/50 data-[chosen=true]:bg-agent-question/15 data-[chosen=true]:text-foreground data-[deny=true]:text-muted-foreground',
  compact:
    'group/opt mt-1.5 flex w-full items-center gap-2 rounded-lg border border-foreground/[0.06] bg-muted px-2 py-1.5 text-left text-[13px] text-foreground/85 transition-colors hover:border-foreground/15 hover:bg-accent/60 hover:text-foreground disabled:cursor-default data-[chosen=true]:border-agent-question/50 data-[chosen=true]:bg-agent-question/15 data-[chosen=true]:text-foreground data-[deny=true]:text-muted-foreground',
  chip: 'group/opt flex max-w-full items-center gap-1.5 rounded-md border border-foreground/[0.08] bg-foreground/[0.03] px-2 py-1 text-xs text-foreground transition-colors hover:border-foreground/15 hover:bg-foreground/[0.07] disabled:cursor-default disabled:opacity-60 data-[chosen=true]:border-agent-question/50 data-[chosen=true]:bg-agent-question/15 data-[chosen=true]:opacity-100 data-[deny=true]:text-muted-foreground data-[recommended=true]:border-ring/60'
}

/** Whether the option's text is cut short here: a clipped line, or a description left out. */
function optionTextIsCut(text: HTMLElement | null, describedOnlyInTooltip: boolean): boolean {
  if (describedOnlyInTooltip) {
    return true
  }
  return Array.from(text?.children ?? []).some(
    (line) => line.scrollWidth > line.clientWidth + 1 || line.scrollHeight > line.clientHeight + 1
  )
}

function HubOption({
  option,
  index,
  density,
  chosen,
  disabled,
  multi = false,
  onChoose
}: {
  option: AgentHubAnswerOption
  index: number
  density: HubOptionDensity
  chosen: boolean
  disabled: boolean
  multi?: boolean
  onChoose: (index: number) => void
}): React.JSX.Element {
  const textRef = useRef<HTMLSpanElement>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  // Chips have no room for it; the pane card keeps it short.
  const showsDescription = Boolean(option.description) && density !== 'chip'
  return (
    <Tooltip
      open={detailsOpen}
      onOpenChange={(next) =>
        setDetailsOpen(
          next && optionTextIsCut(textRef.current, Boolean(option.description) && !showsDescription)
        )
      }
    >
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={multi ? 0 : -1}
          role={multi ? 'checkbox' : undefined}
          aria-checked={multi ? chosen : undefined}
          disabled={disabled}
          data-density={density}
          data-chosen={chosen}
          data-deny={option.deny === true}
          data-recommended={option.recommended === true}
          onClick={() => onChoose(index)}
          className={OPTION_CLASS[density]}
        >
          <span className="grid size-5 shrink-0 place-items-center rounded-md bg-foreground/[0.12] font-mono text-[11px] text-foreground/85 group-data-[chosen=true]/opt:bg-agent-question group-data-[chosen=true]/opt:text-background group-data-[density=chip]/opt:size-4 group-data-[density=chip]/opt:text-[10px]">
            {index + 1}
          </span>
          {multi ? (
            chosen ? (
              <SquareCheck aria-hidden className="size-3.5" />
            ) : (
              <Square aria-hidden className="size-3.5" />
            )
          ) : null}
          <span ref={textRef} className="min-w-0 flex-1">
            <span className="block truncate">{option.label}</span>
            {showsDescription ? (
              <span className="block text-xs text-muted-foreground group-data-[density=compact]/opt:line-clamp-2 group-data-[density=compact]/opt:text-[11px] group-data-[density=compact]/opt:leading-snug">
                {option.description}
              </span>
            ) : null}
          </span>
          {/* A chip has no room for the badge: its border marks the agent's pick. */}
          {option.recommended && density !== 'chip' ? (
            <span className="rounded-full bg-status-warning-background px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-status-warning">
              {translate('agentHub.card.recommended', 'Recommended')}
            </span>
          ) : null}
        </button>
      </TooltipTrigger>
      {/* Why only when cut: the whole text is already on screen otherwise. */}
      <TooltipContent variant="tab-preview" side="right" sideOffset={8} showArrow={false}>
        <span className="block font-medium break-words">{option.label}</span>
        {option.description ? (
          <span className="mt-1 block leading-snug break-words text-muted-foreground">
            {option.description}
          </span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  )
}

/** A pick-list in the mock's style: numbered boxes, the agent's pick badged, one click answers. */
export function HubOptionList({
  options,
  chosen,
  disabled,
  onChoose,
  density = 'card',
  selected,
  label
}: {
  options: readonly AgentHubAnswerOption[]
  chosen: number | null
  disabled: boolean
  onChoose: (index: number) => void
  density?: HubOptionDensity
  selected?: ReadonlySet<number>
  label?: string
}): React.JSX.Element {
  return (
    <div className={LIST_CLASS[density]} role={selected ? 'group' : undefined} aria-label={label}>
      {options.map((option, index) => (
        <HubOption
          key={option.id}
          option={option}
          index={index}
          density={density}
          chosen={selected ? selected.has(index) : chosen === index}
          multi={selected !== undefined}
          disabled={disabled}
          onChoose={onChoose}
        />
      ))}
    </div>
  )
}

/** Free-text answer row; the mic hands the field to Orca's dictation when voice is on. */
export function HubReplyField({
  placeholder,
  disabled,
  allowEmpty = false,
  inputRef,
  onSend,
  onPasteImage
}: {
  placeholder: string
  disabled: boolean
  /** Enter on an empty field still sends (the deny step's plain "No"). */
  allowEmpty?: boolean
  inputRef?: React.Ref<HTMLInputElement>
  onSend: (text: string) => void | boolean | Promise<boolean>
  /** Saves the clipboard's image where the agent runs and returns its path. */
  onPasteImage?: () => Promise<string | null>
}): React.JSX.Element {
  const [value, setValue] = useState('')
  const [images, setImages] = useState<readonly { path: string; preview: string }[]>([])
  const previews = useRef(new Set<string>())
  useEffect(() => {
    const owned = previews.current
    return () => owned.forEach((url) => URL.revokeObjectURL(url))
  }, [])
  /** Drops these attached images (all of them for null) and frees their previews. */
  const dropImages = (paths: ReadonlySet<string> | null): void => {
    for (const image of images) {
      if (!paths || paths.has(image.path)) {
        URL.revokeObjectURL(image.preview)
        previews.current.delete(image.preview)
      }
    }
    setImages((current) => (paths ? current.filter((image) => !paths.has(image.path)) : []))
  }
  const submit = (): void => {
    const text = value.trim()
    if ((text || images.length > 0 || allowEmpty) && !disabled) {
      // Why paths: an answer travels as typed text, and both agents read an image from its path.
      const submittedImages = new Set(images.map((image) => image.path))
      const settled = (delivered: void | boolean): void => {
        if (delivered !== false) {
          setValue((current) => (current.trim() === text ? '' : current))
          dropImages(submittedImages)
        }
      }
      const failed = (): void => {
        toast.error(
          translate('agentHub.requests.sendFailed', 'Could not send your answer. Try again.')
        )
      }
      try {
        const result = onSend([text, ...submittedImages].filter(Boolean).join(' '))
        if (result instanceof Promise) {
          void result.then(settled).catch(failed)
        } else {
          settled(result)
        }
      } catch {
        failed()
      }
    }
  }
  const pasteImage = (event: React.ClipboardEvent<HTMLInputElement>): void => {
    const file = Array.from(event.clipboardData.files).find((entry) =>
      entry.type.startsWith('image/')
    )
    // Why text wins: a copied page carries both, and the words are what was meant.
    if (!onPasteImage || !file || event.clipboardData.getData('text/plain')) {
      return
    }
    event.preventDefault()
    const preview = URL.createObjectURL(file)
    previews.current.add(preview)
    void onPasteImage()
      .then((path) => {
        if (path) {
          setImages((current) => [...current, { path, preview }])
        } else {
          URL.revokeObjectURL(preview)
        }
      })
      .catch(() => URL.revokeObjectURL(preview))
  }
  return (
    <>
      {images.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5" data-agent-hub-reply-images>
          {images.map((image, index) => {
            const name = translate('agentHub.card.pastedImage', 'Image {{value0}}', {
              value0: index + 1
            })
            return (
              <span
                key={image.path}
                title={image.path}
                className="flex items-center gap-1.5 rounded-md border border-foreground/[0.08] bg-background/60 py-0.5 pr-0.5 pl-0.5 text-xs text-muted-foreground"
              >
                <img src={image.preview} alt="" className="size-6 rounded object-cover" />
                {name}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={translate('agentHub.card.removeImage', 'Remove {{value0}}', {
                    value0: name
                  })}
                  onClick={() => dropImages(new Set([image.path]))}
                >
                  <X />
                </Button>
              </span>
            )
          })}
        </div>
      ) : null}
      <form
        className="@container/hub-reply mt-2.5 flex items-center gap-0.5 rounded-lg border border-foreground/[0.08] bg-background/60 py-1 pr-1 pl-3 focus-within:border-foreground/20"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <input
          ref={inputRef}
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          onPaste={pasteImage}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[13px] outline-none placeholder:text-muted-foreground/70"
        />
        <HubDictateButton disabled={disabled} />
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          tabIndex={-1}
          // Why enabled when empty is allowed: a disabled default button blocks Enter submission.
          disabled={disabled || (!allowEmpty && !value.trim() && images.length === 0)}
          aria-label={translate('agentHub.card.send', 'Send')}
          className="size-7"
        >
          <SendHorizontal className="size-4" />
        </Button>
      </form>
    </>
  )
}

/** "wants to run [Bash]" plus the command, as the agent's approval prompt summarized it. */
export function HubApprovalSummary({
  tool,
  command
}: {
  tool: string | null
  command: string | undefined
}): React.JSX.Element {
  return (
    <>
      {tool ? (
        <div className="-mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldQuestion className="size-3.5" />
          {translate('agentHub.card.wantsToRun', 'wants to run')}
          <HubChip>{tool}</HubChip>
        </div>
      ) : null}
      {command ? (
        <div className="mt-2 mb-0.5 rounded-lg border border-border bg-background/70 px-3 py-2.5 font-mono text-xs leading-normal break-all text-foreground/90">
          <span className="text-muted-foreground/70">$</span> {command}
        </div>
      ) : null}
    </>
  )
}

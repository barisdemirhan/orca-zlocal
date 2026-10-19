import { useRef, type ReactNode } from 'react'
import { Captions, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { useAgentHubOrbCaptionSide } from './use-agent-hub-orb-caption-side'
import './agent-hub-orb-speech-bubble.css'

export type AgentHubOrbSpeechBubbleProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  text: string
  speakerLabel?: string
  children: ReactNode
  compact?: boolean
}

export function AgentHubOrbSpeechBubble({
  open,
  onOpenChange,
  text,
  speakerLabel,
  children,
  compact = false
}: AgentHubOrbSpeechBubbleProps): React.JSX.Element {
  const reopenRef = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)
  const hasText = text.trim().length > 0
  const { anchorRef, contentRef, textRef, side, sideOffset } = useAgentHubOrbCaptionSide({
    open: open && hasText,
    compact
  })
  const showLabel = translate('agentHub.orb.showCaptions', 'Show captions')
  const hideLabel = translate('agentHub.orb.hideCaptions', 'Hide captions')
  return (
    <Popover open={open && hasText} onOpenChange={onOpenChange} modal={false}>
      <PopoverAnchor asChild>
        <span ref={anchorRef} className="agent-hub-orb-caption-anchor" data-compact={compact}>
          {children}
          {!open && hasText ? (
            <span className="agent-hub-orb-caption-toggle" data-agent-hub-orb-interactive>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    ref={reopenRef}
                    type="button"
                    variant="secondary"
                    size="icon-xs"
                    aria-label={showLabel}
                    aria-expanded={false}
                    onClick={() => onOpenChange(true)}
                  >
                    <Captions />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{showLabel}</TooltipContent>
              </Tooltip>
            </span>
          ) : null}
        </span>
      </PopoverAnchor>
      <PopoverContent
        data-agent-hub-orb-interactive
        data-agent-hub-orb-captions
        side={side}
        align="center"
        sideOffset={sideOffset}
        collisionPadding={16}
        respectReducedMotion
        className="w-80 max-w-[var(--radix-popover-content-available-width)]"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (restoreFocus.current) {
            restoreFocus.current = false
            reopenRef.current?.focus()
          }
        }}
        onEscapeKeyDown={() => {
          restoreFocus.current = true
        }}
        onInteractOutside={(event) => event.preventDefault()}
        wheelScroll
      >
        <div ref={contentRef} className="agent-hub-orb-caption-content">
          <div className="flex items-center justify-between gap-2 px-3 pt-2">
            <span className="min-w-0 truncate text-xs text-muted-foreground">{speakerLabel}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={hideLabel}
                  onClick={() => {
                    restoreFocus.current = true
                    onOpenChange(false)
                  }}
                >
                  <X />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{hideLabel}</TooltipContent>
            </Tooltip>
          </div>
          <div
            ref={textRef}
            className="agent-hub-orb-caption-text scrollbar-sleek px-3 pb-3 pt-1 text-sm"
          >
            <p className="whitespace-pre-wrap break-words">{text}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

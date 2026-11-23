import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Captions, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { useAgentHubOrbCaptionSide } from './use-agent-hub-orb-caption-side'
import { useAgentHubOrbCaptionVisibility } from './use-agent-hub-orb-caption-visibility'
import './agent-hub-orb-speech-bubble.css'

export type AgentHubOrbSpeechBubbleProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  text: string
  speakerLabel?: string
  children: ReactNode
  compact?: boolean
  engaged?: boolean
  /** How long the bubble stays without a pointer or focus on it; speech gets a minute. */
  durationMs?: number
  /** A header action beside Close, such as opening the full conversation. */
  action?: ReactNode
  /** A muted line under the reply, such as a pending suggestion that needs the full window. */
  hint?: ReactNode
  /** What was written to the sphere, kept above its reply as one muted line. */
  prompt?: string
  /** Stands in for a reply that is still on its way; the bubble stays until it is replaced. */
  status?: ReactNode
}

/** The line a written question waits on: the command the agent runs, or that it is thinking. */
export function AgentHubOrbThinking({ command }: { command?: string }): React.JSX.Element {
  return (
    <p className="flex min-w-0 items-center gap-2 text-muted-foreground">
      <span aria-hidden className="agent-hub-orb-thinking-dots">
        <span />
        <span />
        <span />
      </span>
      {command ? (
        <span className="min-w-0 truncate">
          {translate('agentHub.orb.captionRunning', 'Running')}{' '}
          <code className="font-mono text-xs text-foreground">{command}</code>
        </span>
      ) : (
        translate('agentHub.orb.captionThinking', 'Thinking…')
      )}
    </p>
  )
}

const isCaptionToggle = (target: EventTarget): boolean =>
  target instanceof Element && target.closest('.agent-hub-orb-caption-toggle') !== null

export function AgentHubOrbSpeechBubble({
  open,
  onOpenChange,
  text,
  speakerLabel,
  children,
  compact = false,
  engaged = false,
  durationMs,
  action,
  hint,
  prompt,
  status
}: AgentHubOrbSpeechBubbleProps): React.JSX.Element {
  const reopenRef = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)
  const [anchorHovered, setAnchorHovered] = useState(false)
  const [anchorFocused, setAnchorFocused] = useState(false)
  const [bubbleHovered, setBubbleHovered] = useState(false)
  const [bubbleFocused, setBubbleFocused] = useState(false)
  const hasText = text.trim().length > 0
  const pinned = (hint !== undefined && hint !== null) || (status !== undefined && status !== null)
  const { visible, restore } = useAgentHubOrbCaptionVisibility({
    open,
    text,
    engaged: engaged || anchorHovered || anchorFocused || bubbleHovered || bubbleFocused,
    pinned,
    durationMs
  })
  // Why: a bubble that closes under the pointer or focus never sends pointerleave or blur.
  useEffect(() => {
    if (!visible) {
      setBubbleHovered(false)
      setBubbleFocused(false)
    }
  }, [visible])
  const { anchorRef, contentRef, textRef, side, sideOffset, align, alignOffset } =
    useAgentHubOrbCaptionSide({
      open: visible,
      compact
    })
  const showLabel = translate('agentHub.orb.showCaptions', 'Show captions')
  const closeLabel = translate('agentHub.orb.closeCaption', 'Close')
  const changeOpen = (next: boolean): void => {
    if (!next) {
      setBubbleHovered(false)
      setBubbleFocused(false)
    }
    if (next) {
      restore()
    }
    onOpenChange(next)
  }
  return (
    <Popover open={visible} onOpenChange={changeOpen} modal={false}>
      <PopoverAnchor asChild>
        <span
          ref={anchorRef}
          className="agent-hub-orb-caption-anchor"
          data-compact={compact}
          onPointerEnter={() => setAnchorHovered(true)}
          onPointerLeave={() => setAnchorHovered(false)}
          onFocusCapture={(event) => {
            if (!isCaptionToggle(event.target)) {
              setAnchorFocused(true)
            }
          }}
          onBlurCapture={() => setAnchorFocused(false)}
        >
          {children}
          {!visible && (hasText || pinned) ? (
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
                    onClick={() => changeOpen(true)}
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
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        collisionPadding={16}
        respectReducedMotion
        // Why z-[48]: above the Orb panel (z-[47]) but under dialogs (z-50), like the sphere.
        className="z-[48] w-80 max-w-[var(--radix-popover-content-available-width)]"
        onPointerEnter={() => setBubbleHovered(true)}
        onPointerLeave={() => setBubbleHovered(false)}
        onFocusCapture={() => setBubbleFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setBubbleFocused(false)
          }
        }}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (restoreFocus.current) {
            restoreFocus.current = false
            reopenRef.current?.focus()
          }
        }}
        onEscapeKeyDown={(event) => {
          // Why: Escape in the writing box closes only the box.
          if (
            event.target instanceof Element &&
            event.target.closest('[data-agent-hub-orb-quick-input]')
          ) {
            event.preventDefault()
            return
          }
          restoreFocus.current = true
        }}
        onInteractOutside={(event) => event.preventDefault()}
        wheelScroll
      >
        <div ref={contentRef} className="agent-hub-orb-caption-content">
          <div className="flex items-center justify-between gap-2 px-3 pt-2">
            <span className="min-w-0 truncate text-xs text-muted-foreground">{speakerLabel}</span>
            {action}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={closeLabel}
                  onClick={() => {
                    restoreFocus.current = true
                    changeOpen(false)
                  }}
                >
                  <X />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{closeLabel}</TooltipContent>
            </Tooltip>
          </div>
          <div
            ref={textRef}
            className="agent-hub-orb-caption-text scrollbar-sleek px-3 pb-3 pt-1 text-sm"
          >
            {prompt ? (
              <p className="flex min-w-0 gap-1.5 pb-1 text-xs text-muted-foreground">
                <span className="shrink-0 font-medium">
                  {translate('agentHub.orb.captionYou', 'You')}
                </span>
                <span className="min-w-0 truncate">{prompt}</span>
              </p>
            ) : null}
            {hasText ? <p className="whitespace-pre-wrap break-words">{text}</p> : null}
            {status}
            {hint}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

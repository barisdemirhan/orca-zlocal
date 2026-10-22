import { Mic, Square, MessageSquare } from 'lucide-react'
import type { RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'

function QuickAction({
  label,
  disabled,
  onClick,
  children
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** The one-line box under the sphere; its slot stays reserved so the sphere never jumps. */
export function AgentHubOrbQuickInput({
  open,
  ready,
  inputRef,
  value,
  listening,
  onChange,
  onInput,
  onKeyDown,
  onSubmit,
  onDictate,
  onStopDictation,
  onOpenChat
}: {
  open: boolean
  ready: boolean
  inputRef: RefObject<HTMLInputElement | null>
  value: string
  listening: boolean
  onChange: (value: string) => void
  onInput: () => void
  onKeyDown: () => void
  onSubmit: () => void
  onDictate: () => void
  onStopDictation: () => void
  onOpenChat: () => void
}): React.JSX.Element {
  const label = translate('agentHub.orb.quickInput', 'Message Orb')
  return (
    <div
      data-agent-hub-orb-quick-input
      data-agent-hub-orb-interactive
      data-open={open}
      className="agent-hub-orb-quick focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        aria-label={label}
        autoComplete="off"
        spellCheck={false}
        disabled={!ready}
        tabIndex={open ? 0 : -1}
        placeholder={
          listening
            ? translate('agentHub.orb.quickListening', 'Listening… release to send')
            : translate('agentHub.orb.quickPlaceholder', 'Ask Orb…')
        }
        className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
        onChange={(event) => onChange(event.target.value)}
        onInput={onInput}
        onKeyDown={(event) => {
          onKeyDown()
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault()
            onSubmit()
          }
        }}
      />
      {listening ? (
        <QuickAction
          label={translate('auto.agentHub.orb.finishDictation', 'Finish and send dictation')}
          onClick={onStopDictation}
        >
          <Square />
        </QuickAction>
      ) : (
        <QuickAction
          label={translate('agentHub.card.dictate', 'Dictate')}
          disabled={!ready}
          onClick={onDictate}
        >
          <Mic />
        </QuickAction>
      )}
      <QuickAction
        label={translate('auto.agentHub.orb.showConversation', 'Show conversation')}
        onClick={onOpenChat}
      >
        <MessageSquare />
      </QuickAction>
    </div>
  )
}

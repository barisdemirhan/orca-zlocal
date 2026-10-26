import { Mic, Square, MessageSquare } from 'lucide-react'
import type { RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { useAgentHubOrbName } from './use-agent-hub-orb-identity'
import type { AgentHubOrbQuickDictation } from './use-agent-hub-orb-quick-dictation'

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

/** The one-line box by the sphere; it shows on hover and stays while it is open, holds words or listens. */
export function AgentHubOrbQuickInput({
  open,
  ready,
  inputRef,
  value,
  dictation,
  onChange,
  onInput,
  onKeyDown,
  onSubmit,
  onDictate,
  onStopDictation,
  onOpenChat,
  onClose
}: {
  open: boolean
  ready: boolean
  inputRef: RefObject<HTMLInputElement | null>
  value: string
  dictation: Pick<AgentHubOrbQuickDictation, 'active' | 'phase' | 'missed'>
  onChange: (value: string) => void
  onInput: () => void
  onKeyDown: () => void
  onSubmit: () => void
  onDictate: () => void
  onStopDictation: () => void
  onOpenChat: () => void
  onClose: () => void
}): React.JSX.Element {
  const name = useAgentHubOrbName()
  const { active: listening, phase, missed } = dictation
  const label = translate('agentHub.orb.quickInputNamed', 'Message {{name}}', { name })
  return (
    <div
      data-agent-hub-orb-quick-input
      data-agent-hub-orb-interactive
      data-open={open || listening || value.length > 0}
      className="agent-hub-orb-quick focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget) && !value && !listening) {
          onClose()
        }
      }}
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
          phase === 'starting'
            ? translate('agentHub.orb.quickStarting', 'Starting mic… wait to speak')
            : phase === 'finishing'
              ? translate('auto.components.dictation.DictationIndicator.f082d0cb9d', 'Processing…')
              : listening
                ? translate('agentHub.orb.quickListening', 'Listening… release to send')
                : missed
                  ? translate('agentHub.orb.quickNoSpeech', 'No speech heard. Try again.')
                  : translate('agentHub.orb.quickPlaceholderNamed', 'Ask {{name}}…', { name })
        }
        className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
        onChange={(event) => onChange(event.target.value)}
        onInput={onInput}
        onKeyDown={(event) => {
          onKeyDown()
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault()
            onSubmit()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            onChange('')
            event.currentTarget.blur()
            onClose()
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

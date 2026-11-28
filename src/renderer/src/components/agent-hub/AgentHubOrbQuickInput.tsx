import { Bot, ChevronDown, Mic, Square, MessageSquare } from 'lucide-react'
import { useState, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { BotAvatar } from '../bots/BotAvatar'
import { NativeChatPromptPill } from '../native-chat/composer/editor/NativeChatPromptPill'
import { AgentHubOrbBotPicker } from './AgentHubOrbBotPicker'
import { useAgentHubOrbName } from './use-agent-hub-orb-identity'
import type { AgentHubOrbBotMention } from './use-agent-hub-orb-bot-mention'
import type { AgentHubOrbQuickTarget } from './use-agent-hub-orb-quick-target'
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
  mention,
  quickTarget,
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
  mention: AgentHubOrbBotMention
  /** The chat the line goes to; absent where the Orb has no bot page. */
  quickTarget?: AgentHubOrbQuickTarget
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
  // Why: the menu's portal takes focus, which must not read as leaving the box.
  const [targetMenuOpen, setTargetMenuOpen] = useState(false)
  const { active: listening, phase, missed } = dictation
  const label = translate('agentHub.orb.quickInputNamed', 'Message {{name}}', { name })
  return (
    <div
      data-agent-hub-orb-quick-input
      data-agent-hub-orb-interactive
      data-open={open || targetMenuOpen || listening || value.length > 0 || mention.bot !== null}
      className="agent-hub-orb-quick relative focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
      onBlurCapture={(event) => {
        if (
          !targetMenuOpen &&
          !event.currentTarget.contains(event.relatedTarget) &&
          !value &&
          !listening &&
          !mention.bot
        ) {
          onClose()
        }
      }}
    >
      {mention.bot ? (
        <span className="mr-1.5 flex shrink-0 items-center">
          <NativeChatPromptPill
            icon={Bot}
            avatar={<BotAvatar bot={mention.bot} className="size-full" />}
            label={mention.bot.name}
            selected={false}
          />
        </span>
      ) : null}
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
          if (mention.handleKey(event)) {
            event.preventDefault()
          } else if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault()
            onSubmit()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            onChange('')
            mention.clear()
            event.currentTarget.blur()
            onClose()
          }
        }}
      />
      {mention.listOpen ? <AgentHubOrbBotPicker mention={mention} /> : null}
      {quickTarget ? (
        <DropdownMenu modal={false} open={targetMenuOpen} onOpenChange={setTargetMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              tabIndex={open ? 0 : -1}
              aria-label={translate('agentHub.orb.quickTarget', 'Send to')}
              className="flex max-w-24 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-xs"
            >
              <span className="truncate">{quickTarget.label}</span>
              <ChevronDown aria-hidden className="size-3 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuRadioGroup
              value={quickTarget.target}
              onValueChange={quickTarget.setTarget}
            >
              {quickTarget.options.map((option) => (
                <DropdownMenuRadioItem key={option.id} value={option.id}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
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

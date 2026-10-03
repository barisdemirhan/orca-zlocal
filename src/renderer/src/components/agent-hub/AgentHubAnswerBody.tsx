import { useState } from 'react'
import { Mic, SendHorizontal, ShieldQuestion } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { AskQuestion } from '../../../../shared/native-chat-ask-types'
import { splitRecommendedOptionLabel } from '../native-chat/native-chat-option-label'
import { dispatchDictationControl } from '../dictation/dictation-control-events'
import { HubChip } from './AgentHubAtoms'

export type AgentHubAnswerOption = {
  /** Stable React key; the option's position is what gets sent. */
  id: string
  label: React.ReactNode
  /** Muted styling for the option that declines. */
  deny?: boolean
}

/** A pick-list in the mock's style: numbered boxes, the agent's pick badged, one click answers. */
export function HubOptionList({
  options,
  chosen,
  disabled,
  onChoose
}: {
  options: (AgentHubAnswerOption & { description?: string; recommended?: boolean })[]
  chosen: number | null
  disabled: boolean
  onChoose: (index: number) => void
}): React.JSX.Element {
  return (
    <div>
      {options.map((option, index) => (
        <button
          key={option.id}
          type="button"
          tabIndex={-1}
          disabled={disabled}
          data-chosen={chosen === index}
          data-deny={option.deny === true}
          onClick={() => onChoose(index)}
          className="group/opt mt-1.5 flex w-full items-center gap-2.5 rounded-[10px] border border-foreground/[0.06] bg-muted px-2.5 py-[9px] text-left text-[13px] text-foreground/85 transition-colors hover:border-foreground/15 hover:bg-accent/60 hover:text-foreground disabled:cursor-default data-[chosen=true]:border-agent-question/50 data-[chosen=true]:bg-agent-question/15 data-[chosen=true]:text-foreground data-[deny=true]:text-muted-foreground"
        >
          <span className="grid size-5 shrink-0 place-items-center rounded-md bg-foreground/[0.12] font-mono text-[11px] text-foreground/85 group-data-[chosen=true]/opt:bg-agent-question group-data-[chosen=true]/opt:text-background">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block">{option.label}</span>
            {option.description ? (
              <span className="block text-[11.5px] text-muted-foreground">
                {option.description}
              </span>
            ) : null}
          </span>
          {option.recommended ? (
            <span className="rounded-full bg-status-warning-background px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-status-warning">
              {translate('agentHub.card.recommended', 'Recommended')}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

export function questionOptions(
  question: AskQuestion
): (AgentHubAnswerOption & { description?: string; recommended?: boolean })[] {
  return question.options.map((option, index) => {
    const { label, recommended } = splitRecommendedOptionLabel(option.label)
    return { id: `${index}:${option.label}`, label, recommended, description: option.description }
  })
}

/** Free-text answer row; the mic hands the field to Orca's dictation when voice is on. */
export function HubReplyField({
  placeholder,
  disabled,
  allowEmpty = false,
  inputRef,
  onSend
}: {
  placeholder: string
  disabled: boolean
  /** Enter on an empty field still sends (the deny step's plain "No"). */
  allowEmpty?: boolean
  inputRef?: React.Ref<HTMLInputElement>
  onSend: (text: string) => void
}): React.JSX.Element {
  const [value, setValue] = useState('')
  const voiceEnabled = useAppStore((s) => s.settings?.voice?.enabled === true)
  const submit = (): void => {
    const text = value.trim()
    if ((text || allowEmpty) && !disabled) {
      onSend(text)
      setValue('')
    }
  }
  return (
    <form
      className="mt-2.5 flex items-center gap-0.5 rounded-[11px] border border-foreground/[0.08] bg-background/60 py-[3px] pr-[3px] pl-3 focus-within:border-foreground/20"
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
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent py-1.5 text-[13px] outline-none placeholder:text-muted-foreground/70"
      />
      {voiceEnabled ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={translate('agentHub.card.dictate', 'Dictate')}
          className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
          onClick={(event) => {
            // Why focus first: dictation inserts into whatever field holds focus when it starts.
            event.currentTarget.form?.querySelector('input')?.focus()
            dispatchDictationControl('toggle')
          }}
        >
          <Mic className="size-[15px]" />
        </button>
      ) : null}
      <button
        type="submit"
        tabIndex={-1}
        // Why enabled when empty is allowed: a disabled default button blocks Enter submission.
        disabled={disabled || (!allowEmpty && !value.trim())}
        aria-label={translate('agentHub.card.send', 'Send')}
        className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground disabled:opacity-50"
      >
        <SendHorizontal className="size-[15px]" />
      </button>
    </form>
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
          <ShieldQuestion className="size-[13px]" />
          {translate('agentHub.card.wantsToRun', 'wants to run')}
          <HubChip>{tool}</HubChip>
        </div>
      ) : null}
      {command ? (
        <div className="mt-2 mb-0.5 rounded-[10px] border border-border bg-background/70 px-[11px] py-[9px] font-mono text-xs leading-normal break-all text-foreground/90">
          <span className="text-muted-foreground/70">$</span> {command}
        </div>
      ) : null}
    </>
  )
}

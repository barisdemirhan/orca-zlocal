// A bot's waiting ask as one block for every Agent Hub surface: the answered and held lines folded as
// "Question → answer", the open question with ‹ 2 of 5 › and its quick replies (the recommended one
// filled and starred), a line to answer in your own words, and a footer with the count, "Send 2/3" when
// answers are held, and the caller's own actions (Open, Later). Keys 1-9 pick a reply and ←/→ step,
// while focus is inside the block and not in the input.
import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/class-names'
import { BotItemMarkdown } from '../bots/items/BotItemMarkdown'
import { BotItemsReadFailed } from '../bots/items/BotItemsReadFailed'
import {
  BOT_ITEM_CHIP,
  BOT_ITEM_CHIP_RECOMMENDED,
  BOT_ITEM_OPEN_QUESTION,
  BotItemAnswerLine,
  BotItemChipWords,
  botItemChipTitle
} from '../bots/items/BotItemQuestionStep'
import type { AgentHubBotAskModel } from './use-agent-hub-bot-ask-steps'

const CHIP_ACTION =
  'outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50'
const CHIP_PICKED = 'flex items-center gap-1.5 border-foreground/28 bg-foreground/8 text-foreground'
const STEP_BUTTON =
  'flex size-6 items-center justify-center rounded-md outline-none hover:bg-foreground/6 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-35'

/** `card`: bordered, with its own header (#7 and the item's title); `plain` and `inline`: under a header
 *  the caller draws, `inline` with the own-words line behind a link while replies are offered. */
export type AgentHubBotAskVariant = 'card' | 'plain' | 'inline'

function StepNav({
  at,
  count,
  onStep
}: {
  at: number
  count: number
  onStep: (delta: -1 | 1) => void
}): React.JSX.Element {
  return (
    <span className="-my-[2.5px] -mr-1 flex shrink-0 items-center text-2xs leading-6 whitespace-nowrap text-muted-foreground tabular-nums">
      <button
        type="button"
        aria-label={translate('bots.items.ask.previous', 'Previous question')}
        className={STEP_BUTTON}
        disabled={at <= 0}
        onClick={() => onStep(-1)}
      >
        <ChevronLeft className="size-3.5" />
      </button>
      <span className="px-0.5">
        {translate('bots.items.ask.step', '{{n}} of {{total}}', { n: at + 1, total: count })}
      </span>
      <button
        type="button"
        aria-label={translate('bots.items.ask.next', 'Next question')}
        className={STEP_BUTTON}
        disabled={at >= count - 1}
        onClick={() => onStep(1)}
      >
        <ChevronRight className="size-3.5" />
      </button>
    </span>
  )
}

function splitHeld(held: string | null): readonly string[] {
  return held ? held.split(', ') : []
}

/** The open question with its replies and own-words line; keyed by the question, so its typed words
 *  start over on each. */
function OpenQuestion({
  ask,
  picked,
  onPicked,
  variant,
  disabled
}: {
  ask: AgentHubBotAskModel
  picked: readonly string[]
  onPicked: (labels: readonly string[]) => void
  variant: AgentHubBotAskVariant
  disabled: boolean
}): React.JSX.Element {
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const recommended = translate('bots.items.ask.recommended', 'Recommended')
  const heldTyped =
    ask.held !== null && !ask.replies.some((reply) => ask.held?.split(', ').includes(reply.label))
  const ownWordsShown = variant !== 'inline' || typing || ask.replies.length === 0
  const toggle = (label: string): void =>
    onPicked(picked.includes(label) ? picked.filter((each) => each !== label) : [...picked, label])
  const choose = (label: string): void => (ask.multi ? toggle(label) : ask.pick([label]))
  return (
    <div
      className="flex flex-col gap-2.5"
      onKeyDown={(event) => {
        const number = Number(event.key)
        const reply = ask.replies[number - 1]
        if (disabled || !reply || event.target instanceof HTMLInputElement) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        choose(reply.label)
      }}
    >
      <div className={cn('min-w-0', BOT_ITEM_OPEN_QUESTION)}>
        <BotItemMarkdown text={ask.question} />
      </div>
      {ask.replies.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {ask.replies.map((reply) => {
            const isPicked = ask.multi ? picked.includes(reply.label) : ask.held === reply.label
            const filled = reply.recommended && !ask.multi && ask.held === null
            return (
              <button
                key={reply.label}
                type="button"
                disabled={disabled}
                title={botItemChipTitle(reply, recommended)}
                aria-pressed={isPicked}
                className={cn(
                  BOT_ITEM_CHIP,
                  CHIP_ACTION,
                  isPicked ? CHIP_PICKED : filled ? BOT_ITEM_CHIP_RECOMMENDED : 'text-foreground'
                )}
                onClick={() => choose(reply.label)}
              >
                {isPicked ? <Check className="size-3 shrink-0" /> : null}
                <span className="max-w-full min-w-0">
                  <BotItemChipWords reply={reply} />
                </span>
              </button>
            )
          })}
          {heldTyped && ask.held !== null ? (
            <button
              type="button"
              className={cn(BOT_ITEM_CHIP, CHIP_ACTION, CHIP_PICKED)}
              onClick={() => {
                setText(ask.held ?? '')
                setTyping(true)
              }}
            >
              <Pencil className="size-3 shrink-0" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{ask.held}</span>
            </button>
          ) : null}
        </div>
      ) : null}
      {ask.multi && picked.length > 0 ? (
        <Button
          type="button"
          size="xs"
          className="w-fit"
          disabled={disabled}
          onClick={() => ask.pick(picked)}
        >
          {translate('agentHub.bots.ask.useThese', 'Use these')}
        </Button>
      ) : null}
      {ownWordsShown ? (
        <form
          className="flex"
          onSubmit={(event) => {
            event.preventDefault()
            const words = text.trim()
            if (words && !disabled) {
              ask.reply(words)
              setText('')
            }
          }}
        >
          <Input
            density="compact"
            value={text}
            disabled={disabled}
            autoFocus={typing && variant === 'inline'}
            aria-label={translate('agentHub.bots.ask.ownWords', 'Reply in your own words')}
            placeholder={translate('agentHub.bots.ask.ownWords', 'Reply in your own words')}
            onChange={(event) => setText(event.target.value)}
            // The hub's keys (tabs, rows) stay out of typing; Escape still closes.
            onKeyDown={(event) => {
              if (event.key !== 'Escape') {
                event.stopPropagation()
              }
            }}
          />
        </form>
      ) : (
        <Button
          type="button"
          variant="link-muted"
          size="inlineInherit"
          className="w-fit text-xs"
          onClick={() => setTyping(true)}
        >
          {translate('agentHub.bots.ask.ownWords', 'Reply in your own words')}
        </Button>
      )}
    </div>
  )
}

export function AgentHubBotAskView({
  ask,
  variant = 'card',
  actions,
  className
}: {
  ask: AgentHubBotAskModel
  variant?: AgentHubBotAskVariant
  /** The caller's footer actions (Open #7, Later), after Send. */
  actions?: React.ReactNode
  className?: string
}): React.JSX.Element | null {
  const [draft, setDraft] = useState<{ key: string; labels: readonly string[] } | null>(null)
  const picked = draft?.key === ask.openKey ? draft.labels : splitHeld(ask.held)
  const partial = ask.heldCount < ask.openCount
  // Send would leave these picks behind; "Use these" comes first.
  const unusedPicks = ask.multi && picked.length > 0 && picked.join(', ') !== ask.held
  if (ask.phase === 'closed') {
    return null
  }
  const answered = ask.phase === 'answered'
  const frame = cn(
    'flex min-w-0 flex-col gap-2.5',
    variant === 'card' && 'rounded-xl border border-border bg-card p-3',
    className
  )
  if (answered) {
    return (
      <div data-agent-hub-bot-ask-view="answered" role="status" className={frame}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Check className="size-3.5 shrink-0 text-status-success" aria-hidden />
          <span className="flex-1 whitespace-nowrap">
            {translate('agentHub.bots.ask.answered', 'Answered · {{n}} of {{total}}', {
              n: ask.total,
              total: ask.total
            })}
          </span>
          {actions}
        </div>
      </div>
    )
  }
  const open = ask.phase === 'open'
  return (
    <div
      role="group"
      data-agent-hub-bot-ask-view={ask.phase}
      className={frame}
      onKeyDown={(event) => {
        if (event.target instanceof HTMLInputElement || !ask.nav) {
          return
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault()
          event.stopPropagation()
          ask.step(event.key === 'ArrowLeft' ? -1 : 1)
        }
      }}
    >
      {variant === 'card' ? (
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-agent-question" />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-mono">#{ask.number}</span> {ask.title}
          </span>
          {ask.nav ? <StepNav {...ask.nav} onStep={ask.step} /> : null}
        </div>
      ) : ask.nav ? (
        <div className="flex justify-end">
          <StepNav {...ask.nav} onStep={ask.step} />
        </div>
      ) : null}
      {ask.folded.length > 0 ? (
        <div className="flex flex-col gap-1">
          {ask.folded.map(({ index, question, words, reopens }) => (
            <BotItemAnswerLine
              key={index}
              question={question}
              words={words}
              onClick={reopens ? () => ask.reopen(index) : undefined}
            />
          ))}
        </div>
      ) : null}
      <OpenQuestion
        key={ask.openKey}
        ask={ask}
        picked={picked}
        onPicked={(labels) => setDraft({ key: ask.openKey, labels })}
        variant={variant}
        disabled={!open}
      />
      {ask.phase === 'failed' ? <BotItemsReadFailed onRetry={ask.retry} /> : null}
      {ask.total > 1 || actions || ask.heldCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {ask.total > 1
              ? translate('agentHub.bots.ask.answeredCount', '{{n}} of {{total}} answered', {
                  n: ask.answeredCount,
                  total: ask.total
                })
              : null}
          </span>
          <span className="flex items-center gap-3">
            {ask.heldFiles > 0 ? (
              <span>
                {translate('agentHub.bots.ask.heldFiles', '{{count}} attached', {
                  count: ask.heldFiles
                })}
              </span>
            ) : null}
            {ask.heldCount > 0 && !unusedPicks ? (
              <Button
                type="button"
                size="xs"
                aria-label={
                  partial
                    ? translate(
                        'bots.items.ask.sendSomeLabel',
                        'Send {{count}} of {{total}} answers',
                        {
                          count: ask.heldCount,
                          total: ask.openCount
                        }
                      )
                    : undefined
                }
                onClick={ask.sendHeld}
              >
                {partial
                  ? translate('bots.items.ask.sendSome', 'Send {{count}}/{{total}}', {
                      count: ask.heldCount,
                      total: ask.openCount
                    })
                  : translate('bots.items.ask.send', 'Send')}
              </Button>
            ) : null}
            {actions}
          </span>
        </div>
      ) : null}
    </div>
  )
}

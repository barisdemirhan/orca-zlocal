import { useEffect, useEffectEvent } from 'react'
import { translate } from '@/i18n/i18n'
import { isEditableTarget } from '@/lib/text-input/focus/editable-target'
import { HubOptionList } from './AgentHubAnswerBody'
import type { AgentHubThreadAlert } from './agent-hub-alerts'
import { quickAnswerTargetOf, useAgentHubQuickAnswer } from './use-agent-hub-quick-answer'

const QUICK_OPTION_LIMIT = 4

/**
 * The keys are free for a bubble only while nothing else would take them: the page body, or
 * the bubble itself. A field, a terminal, a focused control or an overlay keeps its own keys.
 */
export function alertKeysAvailable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return true
  }
  if (target === document.body || target === document.documentElement) {
    return true
  }
  return (
    target.closest('[data-agent-hub-alert-stack]') !== null &&
    !isEditableTarget(target) &&
    target.closest('button, a[href], input, textarea, select') === null
  )
}

/**
 * A question's or approval's first answers as chips in its bubble; on the front bubble, 1–9
 * answers and ↵ opens the card while no field, terminal or control has the keys.
 */
export function AgentHubAlertQuickOptions({
  alert,
  answerKeys,
  onOpen,
  onAnswered
}: {
  alert: AgentHubThreadAlert
  answerKeys: boolean
  onOpen: () => void
  onAnswered: () => void
}): React.JSX.Element | null {
  const quick = useAgentHubQuickAnswer(quickAnswerTargetOf(alert.thread))
  const options = quick.options.slice(0, QUICK_OPTION_LIMIT)
  const choose = (index: number, byKey: boolean): void => {
    const settled = (delivered: boolean): void => {
      if (delivered) {
        onAnswered()
      }
    }
    if (byKey) {
      quick.chooseByKey(index, settled)
    } else {
      quick.choose(index, settled)
    }
  }
  const onKey = useEffectEvent((event: KeyboardEvent): void => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.repeat ||
      event.isComposing ||
      !alertKeysAvailable(event.target)
    ) {
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      onOpen()
      return
    }
    const index = /^[1-9]$/.test(event.key) ? Number(event.key) - 1 : -1
    if (index >= 0 && index < options.length && quick.chosen === null) {
      event.preventDefault()
      choose(index, true)
    }
  })
  useEffect(() => {
    if (!answerKeys || options.length === 0) {
      return undefined
    }
    const listener = (event: KeyboardEvent): void => onKey(event)
    window.addEventListener('keydown', listener, true)
    return () => window.removeEventListener('keydown', listener, true)
  }, [answerKeys, options.length])
  if (options.length === 0) {
    return null
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1" data-agent-hub-alert-options>
      <HubOptionList
        density="chip"
        options={options}
        chosen={quick.chosen}
        disabled={quick.chosen !== null || !quick.canAnswer}
        onChoose={(index) => choose(index, false)}
      />
      {quick.chosen === null && quick.options.length > options.length ? (
        <span className="text-xs text-muted-foreground">
          {translate('agentHub.quick.more', '↵ for all {{value0}}', {
            value0: quick.options.length
          })}
        </span>
      ) : null}
    </div>
  )
}

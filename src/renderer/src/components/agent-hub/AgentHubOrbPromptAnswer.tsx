import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { toast } from 'sonner'
import { isNewerApprovalSubject } from '../../../../shared/agent-session/agent-session-approval-subject'
import type { StructuredAgentSessionState } from '../../../../shared/agent-session/structured-agent-session-reducer'
import { respondToStructuredAgentSessionPrompt } from '../native-chat/prompts/structured-agent-session-prompt-response'
import { useStructuredAgentSessionMutate } from '../native-chat/session/structured/writes/use-structured-agent-session-mutate'
import { HubOptionList } from './AgentHubAnswerBody'
import { useAgentHubOrbAnswerKeys } from './agent-hub-orb-answer-keys'
import type { AgentHubOrbAttention } from './agent-hub-orb-state'
import { AGENT_HUB_ORB_TARGET } from './agent-hub-orb-state'
import { supportsStructuredAgentSessionPromptCancel } from '@/runtime/native-chat/host-capabilities/structured-agent-session-host-support'

export function AgentHubOrbPromptAnswer({
  attention,
  sessionId,
  readState,
  onOpen
}: {
  attention: Extract<AgentHubOrbAttention, { kind: 'prompt' }>
  sessionId: string
  readState: StructuredAgentSessionState
  onOpen: () => void
}): React.JSX.Element {
  const stateRef = useRef(readState)
  stateRef.current = readState
  const { mutate, admit } = useStructuredAgentSessionMutate({
    sessionId,
    target: AGENT_HUB_ORB_TARGET,
    stateRef
  })
  const [busy, setBusy] = useState(false)
  const [chosen, setChosen] = useState<number | null>(null)
  const sending = useRef(false)
  const { item } = attention
  const { body } = item
  const simple =
    body.kind === 'approval'
      ? !isNewerApprovalSubject(body.subject)
      : !body.questions && !body.freeTextInput
  const options = simple ? body.options : []
  const typedAllowIndex = options.findIndex((option) => option.permissionKind === 'allow_once')
  const typedDenyIndex = options.findIndex((option) => option.permissionKind === 'reject_once')
  const allowIndex =
    typedAllowIndex !== -1
      ? typedAllowIndex
      : options.findIndex(
          (option) =>
            option.permissionKind === undefined &&
            /^(allow|approve|yes)(?:[ ,]+(?:once|this time|just this once))?[.!]?$/i.test(
              option.label.trim()
            )
        )
  const denyIndex =
    typedDenyIndex !== -1
      ? typedDenyIndex
      : options.findIndex(
          (option) =>
            option.permissionKind === undefined &&
            (/^(deny|reject|decline|cancel|abort)([-_]|$)/i.test(option.id) ||
              /^(deny|reject|decline|cancel|abort|no)\b/i.test(option.label.trim()))
        )
  const submit = (action: () => Promise<unknown>, index: number | null): boolean => {
    if (sending.current) {
      return false
    }
    sending.current = true
    setBusy(true)
    const retry = (): void => {
      sending.current = false
      setBusy(false)
    }
    void action()
      .then((result) => {
        if (result === null) {
          retry()
        } else {
          setChosen(index)
        }
      })
      .catch(() => {
        retry()
        toast.error(
          translate('agentHub.requests.sendFailed', 'Could not send your answer. Try again.')
        )
      })
    return true
  }
  const choose = (index: number): boolean => {
    const option = options[index]
    return (
      option !== undefined &&
      submit(
        () =>
          respondToStructuredAgentSessionPrompt({
            item,
            response: { kind: 'option', optionId: option.id },
            action: admit()
          }),
        index
      )
    )
  }
  const deny = (): boolean =>
    denyIndex !== -1
      ? choose(denyIndex)
      : submit(async () => {
          if (!(await supportsStructuredAgentSessionPromptCancel(AGENT_HUB_ORB_TARGET))) {
            return null
          }
          return mutate('agentSession.cancel', 'agentSession.cancel', {
            prompt: { itemId: item.itemId, expectedRevision: item.revision }
          })
        }, null)
  useAgentHubOrbAnswerKeys((key) => {
    if (body.kind === 'approval' && key === 'Enter') {
      if (allowIndex !== -1) {
        return choose(allowIndex)
      }
      onOpen()
      return true
    }
    if (body.kind === 'approval' && key === 'Escape') {
      return deny()
    }
    if (key === 'Enter') {
      onOpen()
      return true
    }
    return /^[1-9]$/.test(key) && choose(Number(key) - 1)
  })
  return (
    <>
      <button
        type="button"
        className="min-w-0 text-left text-sm text-agent-question-text"
        onClick={onOpen}
      >
        {body.kind === 'approval' ? (body.detail ?? body.title) : body.question}
      </button>
      <HubOptionList
        density="chip"
        options={options}
        chosen={chosen}
        disabled={busy}
        onChoose={choose}
      />
      {body.kind === 'approval' && options.length > 0 ? (
        <span className="text-xs text-muted-foreground">
          {allowIndex !== -1
            ? translate('auto.agentHub.orb.approvalKeys', 'Allow ↵ / Deny esc')
            : translate('auto.agentHub.orb.openDenyKeys', 'Open ↵ / Deny esc')}
        </span>
      ) : null}
      {options.length === 0 ? (
        <Button type="button" variant="ghost" size="xs" onClick={onOpen}>
          {translate('auto.agentHub.orb.open', 'Open')}
        </Button>
      ) : null}
    </>
  )
}

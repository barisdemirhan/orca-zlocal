import { useCallback, useEffect, useRef, useState } from 'react'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { sendAgentHubOrbText, useAgentHubOrbComposerReady } from './agent-hub-orb-composer'
import type { AgentHubOrbState } from './agent-hub-orb-state'
import type { AgentHubInboxRequest } from './agent-hub-requests-store'
import { useAgentHubOrbQuickDictation } from './use-agent-hub-orb-quick-dictation'

/** Writing from the sphere: the one-line box, the reply bubble and which card a click opens first. */
export function useAgentHubOrbQuickWrite({
  tabId,
  state,
  prepareDictation,
  currentRequest,
  onShowChat
}: {
  tabId: string | undefined
  state: AgentHubOrbState
  prepareDictation: () => Promise<boolean>
  currentRequest: AgentHubInboxRequest | undefined
  onShowChat: () => void
}) {
  const open = useAgentHubOrbPanel((s) => s.quickInputOpen)
  const ready = useAgentHubOrbComposerReady(tabId)
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  // Why a latch: the done state expires before the bubble does; a new turn clears it, idle keeps it.
  const [latch, setLatch] = useState<{ key: string; text: string | null }>({ key: '', text: null })
  const latchKey =
    state.kind === 'done' ? `done:${state.expiresAt}` : state.kind === 'working' ? 'working' : ''
  if (latchKey && latchKey !== latch.key) {
    setLatch({ key: latchKey, text: state.kind === 'done' ? state.reply : null })
  }
  const reply = latch.text
  const [laterRequestId, setLaterRequestId] = useState<string | null>(null)
  useEffect(() => {
    if (open && ready) {
      inputRef.current?.focus({ preventScroll: true })
    }
  }, [open, ready])
  const setOpen = useCallback((next: boolean): void => {
    useAgentHubOrbPanel.setState({ quickInputOpen: next })
  }, [])
  const submit = useCallback((): void => {
    const text = inputRef.current?.value ?? ''
    if (tabId && sendAgentHubOrbText(tabId, text)) {
      setDraft('')
      setLatch((current) => ({ ...current, text: null }))
      inputRef.current?.focus({ preventScroll: true })
    }
  }, [tabId])
  const dictation = useAgentHubOrbQuickDictation({
    inputRef,
    prepare: prepareDictation,
    onSend: submit
  })
  const requestDismissed =
    currentRequest !== undefined && currentRequest.request.requestId === laterRequestId
  const showChat = useCallback((): void => {
    setOpen(false)
    onShowChat()
  }, [onShowChat, setOpen])
  return {
    open,
    ready,
    inputRef,
    draft,
    setDraft,
    submit,
    dictation,
    reply,
    replyKey: latch.key,
    requestDismissed,
    showChat,
    /** "Answer later" on the card: the card steps aside and the box opens. */
    later: (): void => {
      setLaterRequestId(currentRequest?.request.requestId ?? null)
      setOpen(true)
    },
    onSphereClick: (): void => {
      if (requestDismissed) {
        setLaterRequestId(null)
        setOpen(false)
        return
      }
      setOpen(!open)
    },
    onSphereHoldStart: (): void => {
      setOpen(true)
      dictation.start()
    }
  }
}

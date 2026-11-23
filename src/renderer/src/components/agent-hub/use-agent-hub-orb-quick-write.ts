import { useCallback, useEffect, useRef, useState } from 'react'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { sendAgentHubOrbText, useAgentHubOrbComposerReady } from './agent-hub-orb-composer'
import type { AgentHubOrbState } from './agent-hub-orb-state'
import type { AgentHubInboxRequest } from './agent-hub-requests-store'
import { useAgentHubOrbBotMention } from './use-agent-hub-orb-bot-mention'
import { botMentionToken } from '../../../../shared/bots/bot-mention-context'
import { useAgentHubOrbQuickDictation } from './use-agent-hub-orb-quick-dictation'

const AGENT_HUB_ORB_STALL_MS = 1_500

export type AgentHubOrbQuickAsk = {
  id: number
  text: string
  status: 'sent' | 'working' | 'answered' | 'failed'
}
type QuickTurn = { key: string; text: string | null; ask: AgentHubOrbQuickAsk | null }

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
  const mention = useAgentHubOrbBotMention(draft, setDraft)
  const mentionedBot = mention.bot
  const clearMention = mention.clear
  // Why a latch: the done state expires before the bubble does; a new turn clears it, idle keeps it.
  const [latch, setLatch] = useState<QuickTurn>({ key: '', text: null, ask: null })
  const latchKey =
    state.kind === 'done' ? `done:${state.expiresAt}` : state.kind === 'working' ? 'working' : ''
  const waiting = latch.ask?.status === 'sent' || latch.ask?.status === 'working' ? latch.ask : null
  if (latchKey && latchKey !== latch.key) {
    setLatch(
      state.kind === 'done'
        ? { key: latchKey, text: state.reply, ask: waiting && { ...waiting, status: 'answered' } }
        : { key: latchKey, text: null, ask: waiting && { ...waiting, status: 'working' } }
    )
  } else if (state.kind === 'working' && waiting?.status === 'sent') {
    // Why: a turn sent after a failed one starts under the same working key.
    setLatch({ ...latch, ask: { ...waiting, status: 'working' } })
  }
  const reply = latch.text
  const ask = latch.ask
  // Why: a turn that ends without a reply first reads as idle for a moment before its outcome lands.
  const stalled = ask?.status === 'working' && (state.kind === 'idle' || state.kind === 'error')
  useEffect(() => {
    if (!stalled) {
      return
    }
    const timer = setTimeout(
      () =>
        setLatch((current) =>
          current.ask?.status === 'working'
            ? { ...current, ask: { ...current.ask, status: 'failed' } }
            : current
        ),
      state.kind === 'error' ? 0 : AGENT_HUB_ORB_STALL_MS
    )
    return () => clearTimeout(timer)
  }, [stalled, state.kind])
  const [laterRequestId, setLaterRequestId] = useState<string | null>(null)
  const askCount = useRef(0)
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
    // Why: the same token a native chat @bot pick sends, so the host adds how to reach the bot.
    const sent = mentionedBot && text.trim() ? `${botMentionToken(mentionedBot)} ${text}` : text
    if (tabId && sendAgentHubOrbText(tabId, sent)) {
      setDraft('')
      clearMention()
      askCount.current += 1
      setLatch((current) => ({
        ...current,
        text: null,
        ask: {
          id: askCount.current,
          text: (mentionedBot ? `@${mentionedBot.name} ${text}` : text).trim(),
          status: 'sent'
        }
      }))
      // Why: the question moves into the bubble, so the box steps aside until it is wanted again.
      setOpen(false)
      inputRef.current?.blur()
    }
  }, [tabId, setOpen, mentionedBot, clearMention])
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
    mention,
    submit,
    dictation,
    reply,
    /** What was asked from the box, kept above the reply; the bubble waits with it until the reply lands. */
    ask,
    replyKey:
      ask && ask.status !== 'answered'
        ? `ask:${ask.id}:${ask.status === 'failed' ? 'failed' : 'pending'}`
        : latch.key,
    close: (): void => setOpen(false),
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
      if (open) {
        inputRef.current?.focus({ preventScroll: true })
      }
      setOpen(true)
    },
    onSphereHoldStart: (): void => {
      setOpen(true)
      dictation.start()
    }
  }
}

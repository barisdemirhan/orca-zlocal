import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { useNow } from '@/hooks/use-now'
import { useAppStore } from '@/store'
import type { StructuredAgentSessionState } from '../../../../shared/agent-session/view/live-read/structured-agent-session-reducer'
import { cancelDictation } from './agent-hub-dictation-cancel'
import { AgentHubDictationPill } from './AgentHubDictationPill'
import { AgentHubOrbMark } from './AgentHubOrbButton'
import { AgentHubOrbRequestAnswer } from './AgentHubOrbRequestAnswer'
import { AgentHubOrbPromptAnswer } from './AgentHubOrbPromptAnswer'
import { AgentHubOrbTerminalAnswer } from './AgentHubOrbTerminalAnswer'
import { placeBesideAnchor, type AgentHubAlertSide } from './AgentHubAlertStack'
import { useAnchorBinding } from './use-anchor-binding'
import type { AgentHubOrbState } from './agent-hub-orb-state'

function Elapsed(): React.JSX.Element {
  const [startedAt] = useState(Date.now)
  const elapsed = Math.max(0, Math.floor((useNow(1000) - startedAt) / 1000))
  return (
    <span
      role="timer"
      aria-live="off"
      className="font-mono text-xs text-muted-foreground tabular-nums"
    >
      {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
    </span>
  )
}

function Listening(): React.JSX.Element {
  const phase = useAppStore((s) =>
    s.dictationState === 'starting' || s.dictationState === 'listening'
      ? s.dictationState
      : 'finishing'
  )
  useEffect(() => {
    const cancel = (event: KeyboardEvent): void => {
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return
      }
      cancelDictation()
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    window.addEventListener('keydown', cancel, true)
    return () => window.removeEventListener('keydown', cancel, true)
  }, [])
  return (
    <>
      <AgentHubDictationPill
        compact
        phase={phase}
        stopActionId="agentHub.toggleOrb"
        stopHint={translate('auto.agentHub.orb.toSend', 'to send')}
      />
      <Elapsed />
    </>
  )
}

export function AgentHubOrbPillContent({
  state,
  sessionId,
  readState,
  onOpen
}: {
  state: AgentHubOrbState
  sessionId: string
  readState: StructuredAgentSessionState
  onOpen: () => void
}): React.JSX.Element | null {
  if (state.kind === 'idle' || state.kind === 'off' || state.kind === 'error') {
    return null
  }
  const label =
    state.kind === 'working'
      ? translate('auto.agentHub.orb.working', 'Working')
      : state.kind === 'done'
        ? translate('auto.agentHub.orb.done', 'Completed')
        : state.kind === 'listening'
          ? translate('auto.agentHub.orb.listening', 'Listening')
          : translate('auto.agentHub.orb.needsAnswer', 'Waiting for your answer')
  const tooltip =
    state.kind === 'working'
      ? state.command
        ? `${label} · ${state.command}`
        : label
      : state.kind === 'done'
        ? state.summary
        : undefined
  return (
    <Tooltip open={tooltip ? undefined : false}>
      <TooltipTrigger asChild>
        <div
          data-agent-hub-orb-pill={state.kind}
          data-agent-hub-alert-stack
          className="flex max-w-[min(32rem,calc(100vw-1rem))] flex-wrap items-center gap-2 rounded-xl border border-border bg-popover px-3 py-2 text-popover-foreground shadow-floating"
        >
          <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {label}
          </span>
          <AgentHubOrbMark state={state} />
          {state.kind === 'listening' ? (
            <Listening />
          ) : state.kind === 'working' ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              aria-label={translate('auto.agentHub.orb.showConversation', 'Show conversation')}
              onClick={onOpen}
            >
              <Elapsed key={sessionId} />
            </Button>
          ) : state.kind === 'done' ? (
            <Button type="button" variant="ghost" size="xs" onClick={onOpen}>
              {translate('auto.agentHub.orb.open', 'Open')}
            </Button>
          ) : state.kind === 'needsYou' ? (
            state.request.kind === 'request' ? (
              <AgentHubOrbRequestAnswer
                key={state.request.item.request.requestId}
                attention={state.request}
                onOpen={onOpen}
              />
            ) : state.request.kind === 'prompt' ? (
              <AgentHubOrbPromptAnswer
                key={`${sessionId}:${state.request.item.itemId}:${state.request.item.revision}`}
                attention={state.request}
                sessionId={sessionId}
                readState={readState}
                onOpen={onOpen}
              />
            ) : (
              <AgentHubOrbTerminalAnswer
                key={state.request.thread.paneKey}
                attention={state.request}
                onOpen={onOpen}
              />
            )
          ) : null}
        </div>
      </TooltipTrigger>
      {tooltip ? <TooltipContent>{tooltip}</TooltipContent> : null}
    </Tooltip>
  )
}

export function AgentHubOrbPill({
  anchorRef,
  side,
  ...props
}: Parameters<typeof AgentHubOrbPillContent>[0] & {
  anchorRef: React.RefObject<HTMLElement | null>
  side: AgentHubAlertSide
}): React.JSX.Element {
  const pillRef = useRef<HTMLDivElement>(null)
  const place = (): void => {
    const pill = pillRef.current
    if (!pill) {
      return
    }
    if (anchorRef.current) {
      pill.style.bottom = ''
      pill.style.transform = ''
      placeBesideAnchor(pill, anchorRef.current, side)
      pill.style.left = `${Math.max(
        8,
        Math.min(Number.parseFloat(pill.style.left), window.innerWidth - pill.offsetWidth - 8)
      )}px`
      pill.style.top = `${Math.max(
        8,
        Math.min(Number.parseFloat(pill.style.top), window.innerHeight - pill.offsetHeight - 8)
      )}px`
    } else {
      pill.style.left = '50%'
      pill.style.top = ''
      pill.style.bottom = '40px'
      pill.style.transform = 'translateX(-50%)'
    }
  }
  useLayoutEffect(place)
  useAnchorBinding(anchorRef, side, (anchor) => {
    const resizes = new ResizeObserver(place)
    resizes.observe(anchor)
    if (pillRef.current) {
      resizes.observe(pillRef.current)
    }
    const moves = new MutationObserver(place)
    moves.observe(anchor, { attributes: true, attributeFilter: ['style', 'data-edge'] })
    window.addEventListener('resize', place)
    return () => {
      resizes.disconnect()
      moves.disconnect()
      window.removeEventListener('resize', place)
    }
  })
  return createPortal(
    <div ref={pillRef} className="fixed z-[48] w-max max-w-[calc(100vw-1rem)]">
      <AgentHubOrbPillContent {...props} />
    </div>,
    document.body
  )
}

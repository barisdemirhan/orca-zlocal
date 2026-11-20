import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { MessagesSquare } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import { setAgentHubOrbRequestDestination, useAgentHubOrbPanel } from './agent-hub-orb-panel-store'

export function AgentHubOrbRequestModal({
  pending,
  requestKey,
  children
}: {
  pending: boolean
  requestKey: string
  children?: ReactNode
}): React.JSX.Element {
  const [dismissed, setDismissed] = useState<string | null>(null)
  const homeRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const [container] = useState(() => {
    const node = document.createElement('div')
    node.className = 'min-h-0 min-w-0'
    node.dataset.agentHubOrbModalRequestHost = ''
    return node
  })
  const open = pending && dismissed !== requestKey
  useLayoutEffect(() => {
    if (!container.parentElement) {
      homeRef.current?.appendChild(container)
    }
    setAgentHubOrbRequestDestination(container)
    return () => {
      if (useAgentHubOrbPanel.getState().requestDestination === container) {
        setAgentHubOrbRequestDestination(null)
      }
      container.remove()
    }
  }, [container])
  const bind = useCallback(
    (node: HTMLDivElement | null) => {
      ;(node ?? homeRef.current)?.appendChild(container)
    },
    [container]
  )
  return (
    <>
      <div ref={homeRef} hidden />
      {createPortal(children, container)}
      {pending ? (
        <Button
          type="button"
          variant="outline"
          size="xs"
          aria-label={translate('auto.agentHub.orb.needsAnswer', 'Waiting for your answer')}
          onClick={() => setDismissed(null)}
        >
          <MessagesSquare />
          <span className="hidden sm:inline">
            {translate('auto.agentHub.orb.needsAnswer', 'Waiting for your answer')}
          </span>
        </Button>
      ) : null}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setDismissed(requestKey)
          }
        }}
      >
        <DialogContent
          data-agent-hub-orb-request-modal
          showCloseButton={false}
          className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-2xl"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            previousFocus.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null
            titleRef.current?.focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (previousFocus.current?.isConnected) {
              previousFocus.current.focus()
            }
          }}
          onEscapeKeyDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setDismissed(requestKey)
          }}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <DialogTitle ref={titleRef} tabIndex={-1}>
                {translate('agentHub.orb.requestTitle', 'Orb is waiting for you')}
              </DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setDismissed(requestKey)}
              >
                {translate('agentHub.orb.answerLater', 'Answer later')}
              </Button>
            </div>
            <DialogDescription>
              {translate(
                'agentHub.orb.requestDescription',
                'Your answer will return to this Orb conversation.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="scrollbar-sleek min-h-0 overflow-y-auto overscroll-contain">
            <div ref={bind} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

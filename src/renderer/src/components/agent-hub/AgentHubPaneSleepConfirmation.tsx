import { useState } from 'react'
import { Loader2, Moon, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { useAgentHubPaneSleep } from './agent-hub-pane-sleep'
import { useAgentHubPaneSleepConfirmation } from './agent-hub-pane-sleep-confirmation'

function SleepConfirmation({
  target,
  dismiss,
  origin
}: {
  target: AgentHubPaneTarget
  dismiss: () => void
  origin: HTMLElement | null
}): React.JSX.Element {
  const state = useAgentHubPaneSleep(target)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = submitting || state.phase === 'sleeping-pending'
  const agent = state.kind === 'agent'
  const Icon = agent ? Moon : Pause
  const confirm = async (): Promise<void> => {
    setSubmitting(true)
    setError(null)
    try {
      await state.sleep()
      dismiss()
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : translate('agentHub.sleep.failed', 'Could not put this pane to sleep. Try again.')
      )
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) {
          dismiss()
        }
      }}
    >
      <DialogContent
        // Why above popovers: asked from the hub panel, which must stay open behind it.
        className="z-[65]"
        overlayClassName="z-[65]"
        showCloseButton={!busy}
        onCloseAutoFocus={(event) => {
          if (origin?.isConnected) {
            event.preventDefault()
            origin.focus({ preventScroll: true })
          }
        }}
        onEscapeKeyDown={(event) => {
          if (busy) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <Icon className="size-4" />
              {agent
                ? translate('agentHub.sleep.agentTitle', 'Put this agent to sleep?')
                : translate('agentHub.sleep.terminalTitle', 'Pause this terminal?')}
            </span>
          </DialogTitle>
          <DialogDescription>
            {agent
              ? translate(
                  'agentHub.sleep.agentDetail',
                  'The session is saved and the agent stops. Wake it here to resume the saved session. Work in progress will be interrupted.'
                )
              : translate(
                  'agentHub.sleep.terminalDetail',
                  'Processes pause and stop using CPU. Memory stays allocated. Wake this terminal to continue the same processes.'
                )}
          </DialogDescription>
        </DialogHeader>
        <p className="truncate text-sm font-medium">{target.title}</p>
        {state.reason ? <p className="text-sm text-muted-foreground">{state.reason}</p> : null}
        {error || state.error ? (
          <p role="alert" className="text-sm text-destructive">
            {error ?? state.error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={dismiss} autoFocus>
            {translate('common.cancel', 'Cancel')}
          </Button>
          <Button
            disabled={busy || !state.canSleep || state.phase !== 'awake'}
            onClick={() => void confirm()}
          >
            {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Icon />}
            {busy
              ? translate('agentHub.sleep.pending', 'Putting to sleep…')
              : translate('agentHub.sleep.action', 'Sleep')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Mounted outside menus so closing a menu cannot dismiss its confirmation. */
export function AgentHubPaneSleepConfirmationHost(): React.JSX.Element | null {
  const target = useAgentHubPaneSleepConfirmation((state) => state.target)
  const origin = useAgentHubPaneSleepConfirmation((state) => state.origin)
  const dismiss = useAgentHubPaneSleepConfirmation((state) => state.dismiss)
  return target ? <SleepConfirmation target={target} dismiss={dismiss} origin={origin} /> : null
}

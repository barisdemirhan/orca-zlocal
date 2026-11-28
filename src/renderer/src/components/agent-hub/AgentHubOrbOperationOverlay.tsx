import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Orbit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { parseRemoteRuntimePtyId } from '../../../../shared/remote-runtime/remote-runtime-pty-id'
import type { AgentHubOrbOperation } from '../../../../shared/agent-hub-orb-operation'
import { subscribeAgentHubRequests } from './agent-hub-requests-store'
import {
  readOrbOperationForSurface,
  type OrbOperationSurface
} from './agent-hub-orb-operation-target'

// Short writes finish before this; the card appears only when protection actually lingers.
const OVERLAY_REVEAL_DELAY_MS = 400

export function AgentHubOrbOperationOverlay(
  surface: OrbOperationSurface
): React.JSX.Element | null {
  const operation = useSyncExternalStore(subscribeAgentHubRequests, () =>
    readOrbOperationForSurface(surface)
  )
  return operation ? (
    <OrbOperationCard key={operation.id} surface={surface} operation={operation} />
  ) : null
}

function OrbOperationCard({
  surface,
  operation
}: {
  surface: OrbOperationSurface
  operation: AgentHubOrbOperation
}): React.JSX.Element {
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState(false)
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), OVERLAY_REVEAL_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])
  const takeControl = async () => {
    if (pending) {
      return
    }
    setPending(true)
    setFailure(false)
    const remote = surface.ptyId ? parseRemoteRuntimePtyId(surface.ptyId) : null
    const host = surface.host ?? remote?.environmentId ?? 'local'
    try {
      await callRuntimeRpc(
        host === 'local' ? { kind: 'local' } : { kind: 'environment', environmentId: host },
        'agentHub.orb.releaseOperation',
        { operationId: operation.id }
      )
    } catch {
      setFailure(true)
    } finally {
      setPending(false)
    }
  }
  return (
    <div
      className="absolute inset-0 z-40 flex items-start justify-center bg-background/5 p-3"
      data-orb-operation-protection={operation.id}
    >
      {revealed ? (
        <div
          role="status"
          className="flex max-w-full items-center gap-2 rounded-lg border border-border bg-popover p-2 text-sm text-popover-foreground shadow-floating"
        >
          <Orbit className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>{translate('agentHub.orb.operation.working', 'Orb is working here')}</span>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => void takeControl()}
          >
            {translate('agentHub.orb.operation.takeControl', 'Take control')}
          </Button>
          {failure ? (
            <span>
              {translate(
                'agentHub.orb.operation.unverifiable',
                'Control could not be verified. Reconnect and try again.'
              )}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function AgentHubOrbSessionOperationGuard({
  host,
  sessionId,
  children
}: {
  host: string
  sessionId: string
  children: ReactNode
}): React.JSX.Element {
  const operation = useSyncExternalStore(subscribeAgentHubRequests, () =>
    readOrbOperationForSurface({ host, sessionId })
  )
  return (
    <div className="relative flex h-full min-h-0 min-w-0 w-full flex-col">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col" inert={Boolean(operation)}>
        {children}
      </div>
      <AgentHubOrbOperationOverlay host={host} sessionId={sessionId} />
    </div>
  )
}

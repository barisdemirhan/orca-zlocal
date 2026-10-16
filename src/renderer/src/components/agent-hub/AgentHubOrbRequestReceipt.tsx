import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { AgentHubOrbRequestReceipt as Receipt } from './agent-hub-orb-request-receipts'
import { dismissAgentHubOrbRequestReceipt } from './agent-hub-requests-store'

export function AgentHubOrbRequestReceipt({
  receipt,
  host
}: {
  receipt: Receipt
  host: string
}): React.JSX.Element {
  const message =
    receipt.reason === 'already_resolved' || receipt.reason === 'request_not_found'
      ? translate(
          'auto.agentHub.orb.requestNoLongerAvailable',
          'This request was answered elsewhere or is no longer available.'
        )
      : receipt.reason === 'denied_by_user'
        ? translate('auto.agentHub.orb.requestDenied', 'Request denied')
        : receipt.reason === 'timeout' || receipt.reason === 'no_response'
          ? translate('auto.agentHub.orb.requestExpired', 'Request expired')
          : receipt.reason === 'responded' && receipt.result?.by === 'human'
            ? translate('auto.agentHub.orb.answerReceived', 'Answer received')
            : receipt.reason === 'responded' && receipt.result?.by === 'away-default'
              ? translate('auto.agentHub.orb.awayAnswerReceived', 'Answered by your away settings')
              : translate('auto.agentHub.orb.requestClosed', 'Request closed')
  const dismissLabel = translate(
    'auto.agentHub.orb.dismissRequestOutcome',
    'Dismiss request outcome'
  )
  return (
    <div
      data-agent-hub-orb-request-receipt={receipt.reason}
      className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"
    >
      <span role="status" className="min-w-0 flex-1">
        {message}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={dismissLabel}
            onClick={() =>
              dismissAgentHubOrbRequestReceipt(host, receipt.sessionId, receipt.requestId)
            }
          >
            <X />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{dismissLabel}</TooltipContent>
      </Tooltip>
    </div>
  )
}

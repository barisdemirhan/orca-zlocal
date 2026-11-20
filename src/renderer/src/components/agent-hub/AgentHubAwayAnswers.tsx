import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { HubCrumb } from './AgentHubInlineLabels'
import {
  dismissAgentHubAwayAnswer,
  useAgentHubRequests,
  agentHubRequestKey
} from './agent-hub-requests-store'
import type { AgentHubRequestBase } from '../../../../shared/agent-hub-requests'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'

export function AgentHubAwayAnswers({
  presentationOf
}: {
  presentationOf: (host: string, request: AgentHubRequestBase) => AgentHubRequestPresentation
}): React.JSX.Element {
  const requests = useAgentHubRequests()
  return (
    <>
      {[...requests].flatMap(([host, view]) =>
        [...view.awayAnswers.values()].map((answer) => (
          <div
            key={agentHubRequestKey(host, answer.requestId)}
            data-agent-hub-away-answer
            className="mt-2 flex items-start gap-2 rounded-lg bg-muted px-3 py-2"
          >
            <div className="min-w-0 flex-1 text-xs">
              <div className="break-words">
                {translate(
                  'agentHub.requests.awayAnswer',
                  '@{{agent}} chose {{answer}} while you were away',
                  {
                    agent: answer.caller.agentType ?? 'agent',
                    answer: answer.result.answer
                  }
                )}
              </div>
              <HubCrumb location={presentationOf(host, answer).location} />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={translate('agentHub.alert.dismiss', 'Dismiss')}
              onClick={() => dismissAgentHubAwayAnswer(host, answer.requestId)}
            >
              <X />
            </Button>
          </div>
        ))
      )}
    </>
  )
}

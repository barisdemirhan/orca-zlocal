import { translate } from '@/i18n/i18n'
import { HubCrumb } from './AgentHubInlineLabels'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'

export function AgentHubRequestSource({
  presentation
}: {
  presentation: AgentHubRequestPresentation
}): React.JSX.Element {
  const { title, location, related } = presentation
  const showTitle = title !== location.project || location.group || location.workspace
  return (
    <>
      {showTitle ? <div className="break-words text-xs text-muted-foreground">{title}</div> : null}
      <HubCrumb
        location={related?.location.host === location.host ? { ...location, host: null } : location}
        wrap
      />
      {related ? (
        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          <div className="break-words font-medium">
            {translate('agentHub.requests.regardingAgent', 'Regarding {{agent}}', {
              agent: related.agentType ? `@${related.agentType}` : related.title
            })}
          </div>
          {related.agentType ? <div className="break-words">{related.title}</div> : null}
          <HubCrumb location={related.location} wrap />
        </div>
      ) : null}
    </>
  )
}

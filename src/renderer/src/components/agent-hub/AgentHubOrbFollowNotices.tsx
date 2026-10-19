import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useAgentHubOrbFollowStore } from './agent-hub-orb-follow-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

export function AgentHubOrbFollowNotices({
  onOpenTarget
}: {
  onOpenTarget: (target: AgentHubPaneTarget) => void
}): React.JSX.Element | null {
  const notices = useAgentHubOrbFollowStore((s) => s.notices)
  const delivery = useAgentHubOrbFollowStore((s) => s.delivery)
  if (!notices.length) {
    return null
  }
  return (
    <div
      className="scrollbar-sleek max-h-32 shrink-0 overflow-y-auto border-b px-3 py-2 text-xs"
      aria-live="polite"
    >
      {notices.map((notice) => (
        <div key={notice.id} className="flex items-start gap-2 py-1">
          <p className="min-w-0 flex-1 text-muted-foreground">
            <span className="font-medium text-foreground">{notice.target.title}</span> ·{' '}
            {notice.text}
          </p>
          <Button variant="ghost" size="xs" onClick={() => onOpenTarget(notice.target)}>
            {translate('common.open', 'Open')}
          </Button>
        </div>
      ))}
      {delivery === 'unverifiable' ? (
        <p role="status" className="text-muted-foreground">
          {translate(
            'agentHub.follow.deliveryUnverifiable',
            'Live delivery could not be verified. Review the current agent here.'
          )}
        </p>
      ) : null}
    </div>
  )
}

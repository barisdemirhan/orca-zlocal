import { translate } from '@/i18n/i18n'
import { Button } from '../ui/button'
import { closeAgentHubOrbPanel, useAgentHubOrbPanel } from './agent-hub-orb-panel-store'

/** Stands in for a chat the Orb window holds, which can show in one place at a time. */
export function AgentHubOrbBorrowedChat({
  tabId
}: {
  tabId: string | undefined
}): React.JSX.Element | null {
  const borrowed = useAgentHubOrbPanel(
    (s) => tabId !== undefined && s.session?.tabId === tabId && s.destination !== null
  )
  if (!borrowed) {
    return null
  }
  return (
    <div
      data-agent-hub-orb-borrowed-chat
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background text-xs text-muted-foreground"
    >
      <span>{translate('agentHub.tab.shownInOrb', 'Shown in the Orb window')}</span>
      {/* Hiding the Orb window leaves its chat running and returns it to this tab. */}
      <Button type="button" variant="outline" size="xs" onClick={closeAgentHubOrbPanel}>
        {translate('agentHub.tab.bringBack', 'Bring back')}
      </Button>
    </div>
  )
}

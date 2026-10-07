import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Button } from '../ui/button'
import { useAgentHubBorrowedTabs } from './agent-hub-borrowed-tabs'
import { closeAgentHubMirror } from './agent-hub-mirror-store'

export function AgentHubBorrowedTerminal({
  worktreeId,
  groupId
}: {
  worktreeId: string
  groupId: string
}): React.JSX.Element | null {
  const enabled = useAppStore((state) => state.settings?.experimentalAgentHub === true)
  const borrowed = useAgentHubBorrowedTabs().find(
    (tab) => tab.worktreeId === worktreeId && tab.groupId === groupId
  )
  if (!enabled || !borrowed) {
    return null
  }
  return (
    <div
      data-agent-hub-borrowed-terminal
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background text-xs text-muted-foreground"
    >
      <span>{translate('agentHub.tab.shownInMirror', 'Shown in a mirror')}</span>
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={() => closeAgentHubMirror(borrowed.mirrorKey)}
      >
        {translate('agentHub.tab.bringBack', 'Bring back')}
      </Button>
    </div>
  )
}

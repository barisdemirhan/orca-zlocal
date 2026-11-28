import { PanelsTopLeft } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'

export function AgentHubMirrorInWorkspaceNotice({
  onMinimize
}: {
  onMinimize: () => void
}): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 bg-popover/60 px-8 text-center">
      <PanelsTopLeft className="size-6 text-muted-foreground" />
      <div className="text-sm font-semibold">
        {translate('agentHub.mirror.inWorkspaceTitle', "You're in this workspace")}
      </div>
      <p className="max-w-85 text-xs text-muted-foreground">
        {translate(
          'agentHub.mirror.inWorkspace',
          'This pane is on screen in your current workspace, so it stays there. It moves back into this window when you switch to another tab or workspace.'
        )}
      </p>
      <Button type="button" variant="ghost" size="xs" onClick={onMinimize} className="mt-1">
        {translate('agentHub.mirror.minimize', 'Minimize')}
      </Button>
    </div>
  )
}

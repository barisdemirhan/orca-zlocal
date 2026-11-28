import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { AgentHubActionTooltip } from './AgentHubShortcut'
import { useMenuOpeningClickGuard } from './use-menu-opening-click-guard'

export function AgentHubMirrorCloseButton({
  isAgent,
  onClose,
  onCloseAgent
}: {
  isAgent: boolean
  onClose: () => void
  onCloseAgent?: () => void
}): React.JSX.Element {
  const openingClick = useMenuOpeningClickGuard()
  const label = translate('agentHub.mirror.close', 'Close mirror')
  const control = (
    <AgentHubActionTooltip label={label}>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground hover:text-foreground"
        aria-label={label}
        onClick={onClose}
      >
        <X className="size-3.5" />
      </Button>
    </AgentHubActionTooltip>
  )
  if (!onCloseAgent) {
    return control
  }
  return (
    <ContextMenu onOpenChange={openingClick.noteOpenChange}>
      <ContextMenuTrigger asChild>
        <span className="contents">{control}</span>
      </ContextMenuTrigger>
      <ContextMenuContent data-agent-hub-mirror-close-menu>
        <ContextMenuItem
          onSelect={(event) => {
            if (openingClick.isOpeningClick()) {
              event.preventDefault()
              return
            }
            onCloseAgent()
          }}
        >
          <X />
          {isAgent
            ? translate('agentHub.row.closeAgent', 'Close agent')
            : translate('agentHub.row.closeShell', 'Close terminal')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

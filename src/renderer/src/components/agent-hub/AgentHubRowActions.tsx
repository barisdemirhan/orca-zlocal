import { Maximize2, Minus, PictureInPicture2, X } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AgentHubShortcut } from './AgentHubShortcut'
import { translate } from '@/i18n/i18n'
import {
  closeAgentHubMirror,
  closeAgentHubMirrorChip,
  requestAgentHubMirrorsDock,
  restoreAgentHubMirror,
  useAgentHubMirrorPresence
} from './agent-hub-mirror-store'

export function HubRowAction({
  label,
  actionId,
  onClick,
  children
}: {
  label: string
  actionId?: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          // Why tabIndex -1: the list is driven by arrow keys; Tab switches hub tabs.
          tabIndex={-1}
          // Why: focus stays on the panel, which owns the keys, even when this button goes away.
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.stopPropagation()
            onClick()
          }}
          className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        <span className="flex items-center gap-2">
          {label}
          <AgentHubShortcut actionId={actionId} />
        </span>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * The row's mirror button: pop out, then (same spot, so the pointer need not move) send to the
 * hub, then bring back. A pane that has a mirror also gets a close button before it.
 */
export function HubRowMirrorActions({
  mirrorKey,
  onPopout
}: {
  mirrorKey: string
  onPopout: () => void
}): React.JSX.Element {
  const presence = useAgentHubMirrorPresence(mirrorKey)
  return (
    <>
      {presence ? (
        <HubRowAction
          label={translate('agentHub.mirror.close', 'Close mirror')}
          onClick={() =>
            presence === 'window'
              ? closeAgentHubMirror(mirrorKey)
              : closeAgentHubMirrorChip(mirrorKey)
          }
        >
          <X className="size-[13px]" />
        </HubRowAction>
      ) : null}
      {/* Why one button for all three: it stays mounted, so its hover and tooltip carry over. */}
      <HubRowAction
        actionId={presence ? undefined : 'agentHub.popOut'}
        label={
          presence === 'window'
            ? translate('agentHub.row.sendToHub', 'Send to the hub')
            : presence === 'chip'
              ? translate('agentHub.row.bringBack', 'Bring back')
              : translate('agentHub.row.popOut', 'Pop out')
        }
        onClick={() => {
          if (presence === 'window') {
            requestAgentHubMirrorsDock(mirrorKey)
          } else if (presence === 'chip') {
            restoreAgentHubMirror(mirrorKey)
          } else {
            onPopout()
          }
        }}
      >
        {presence === 'window' ? (
          <Minus className="size-[13px]" />
        ) : presence === 'chip' ? (
          <Maximize2 className="size-[13px]" />
        ) : (
          <PictureInPicture2 className="size-[13px]" />
        )}
      </HubRowAction>
    </>
  )
}

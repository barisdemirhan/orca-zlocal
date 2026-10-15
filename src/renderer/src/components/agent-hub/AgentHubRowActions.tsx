import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { findAgentHubMirrorMembership } from './agent-hub-mirror-membership'
import { returnAgentHubMirrorTabToWorkspace } from './agent-hub-mirror-tab-operations'
import { returnAgentHubMirrorTabHome } from './agent-hub-mirror-viewing'
import { Maximize2, PictureInPicture2, Minimize2, X } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AgentHubShortcut } from './AgentHubShortcut'
import { translate } from '@/i18n/i18n'
import { showAgentHubMirrorMember } from './agent-hub-mirror-member-navigation'
import { useAgentHubMirrors } from './agent-hub-mirror-store'

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
  target,
  onPopout
}: {
  mirrorKey: string
  target?: AgentHubPaneTarget
  onPopout: () => void
}): React.JSX.Element {
  const mirrors = useAgentHubMirrors()
  const owner = findAgentHubMirrorMembership(mirrors, target ?? mirrorKey)
  const presence = owner?.presence
  const grouped = (owner?.window.tabs.length ?? 0) > 1
  return (
    <>
      {presence ? (
        <HubRowAction
          label={
            grouped || owner?.kind === 'viewing'
              ? translate('agentHub.mirror.returnToWorkspace', 'Return to workspace')
              : translate('agentHub.mirror.close', 'Close mirror')
          }
          onClick={() => {
            if (owner) {
              if (owner.kind === 'viewing') {
                returnAgentHubMirrorTabHome(owner.window.id, owner.tab.id)
              } else {
                returnAgentHubMirrorTabToWorkspace(owner.window.id, owner.tab.id)
              }
            }
          }}
        >
          <Minimize2 className="size-3.5" />
        </HubRowAction>
      ) : null}
      {/* Why one button for all three: it stays mounted, so its hover and tooltip carry over. */}
      <HubRowAction
        actionId={presence ? undefined : 'agentHub.popOut'}
        label={
          presence === 'window'
            ? translate('agentHub.row.showInMirror', 'Show in mirror')
            : presence === 'chip'
              ? translate('agentHub.row.bringBack', 'Bring back')
              : translate('agentHub.row.popOut', 'Pop out')
        }
        onClick={() => {
          if (owner) {
            showAgentHubMirrorMember(target ?? owner.tab.viewing ?? owner.tab.target)
          } else {
            onPopout()
          }
        }}
      >
        {presence === 'window' ? (
          <PictureInPicture2 className="size-3.5" />
        ) : presence === 'chip' ? (
          <Maximize2 className="size-3.5" />
        ) : (
          <PictureInPicture2 className="size-3.5" />
        )}
      </HubRowAction>
    </>
  )
}

/** Ends the pane's agent (or shell) and closes its pane or tab, unlike the mirror's own close. */
export function HubRowCloseAgent({
  isAgent,
  onClose
}: {
  isAgent: boolean
  onClose: () => void
}): React.JSX.Element {
  return (
    <HubRowAction
      label={
        isAgent
          ? translate('agentHub.row.closeAgent', 'Close agent')
          : translate('agentHub.row.closeShell', 'Close terminal')
      }
      onClick={onClose}
    >
      <X className="size-3.5" />
    </HubRowAction>
  )
}

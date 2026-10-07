import { activeAgentHubMirrorTab } from './agent-hub-mirror-membership'
import { useRef, useState } from 'react'
import { ArrowUpRight, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Badge } from '../ui/badge'
import { activityThreadRowCopy } from '../activity/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { HubAvatar, HubCrumb, HubStateIndicator } from './AgentHubAtoms'
import { AgentHubAlertStack, type AgentHubAlertSide } from './AgentHubAlertStack'
import type { AgentHubAlert } from './agent-hub-alerts'
import type { AgentHubIndicatorKind } from './agent-hub-lists'
import {
  isAgentHubMirrorStageQuiet,
  openAgentHubMirror,
  type AgentHubMirrorChip as ChipState
} from './agent-hub-mirror-store'
import { paneTargetFromThread, type AgentHubLocation } from './agent-hub-pane-target'
import { useAgentHubTargetTitle } from './AgentHubMirrorTitle'

/** A minimized mirror in the tray beside the hub: click to restore; it speaks up when its agent does. */
export function AgentHubMirrorChip({
  chip,
  thread,
  kind,
  location,
  alert,
  alertSide,
  locationOfAlert,
  onRestore,
  onReveal,
  onClose,
  onOpenAlert,
  onDismissAlert
}: {
  chip: ChipState
  thread: AgentPaneThread | null
  kind: AgentHubIndicatorKind
  location: AgentHubLocation
  alert: AgentHubAlert | null
  /** The side away from the hub, where the chip's alert opens. */
  alertSide: AgentHubAlertSide
  locationOfAlert?: (alert: AgentHubAlert) => AgentHubLocation
  onRestore: () => void
  /** Closes the chip and opens the pane in its workspace. */
  onReveal: (alert?: AgentHubAlert) => void
  onClose: () => void
  onOpenAlert: (alert: AgentHubAlert) => void
  onDismissAlert: (id: string) => void
}): React.JSX.Element {
  const chipRef = useRef<HTMLDivElement>(null)
  // Put back at launch: it is simply there, without the arriving animation.
  const [restored] = useState(isAgentHubMirrorStageQuiet)
  const target = activeAgentHubMirrorTab(chip.window).target
  const title = useAgentHubTargetTitle(target)

  return (
    <>
      <div
        ref={chipRef}
        role="button"
        tabIndex={0}
        aria-label={translate('agentHub.mirror.restore', 'Restore {{value0}}', {
          value0: title
        })}
        data-agent-hub-mirror-chip
        data-restored={restored}
        data-kind={kind}
        onClick={(event) => {
          if (!(event.target instanceof Element && event.target.closest('button'))) {
            onRestore()
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onRestore()
          }
        }}
        // Why a mini header: the chip should say whose terminal it is, where, and let it go.
        // The ask tint is a layer over the opaque card, so piled chips never show through.
        className="group/chip flex h-10 w-[280px] shrink-0 animate-in cursor-pointer items-center gap-2 rounded-xl border border-foreground/20 bg-popover pr-1 pl-2 text-popover-foreground shadow-floating duration-200 select-none fade-in-0 zoom-in-95 hover:border-foreground/35 data-[restored=true]:animate-none data-[kind=ask]:border-agent-question/60 data-[kind=ask]:bg-linear-to-r data-[kind=ask]:from-agent-question/10 data-[kind=ask]:to-agent-question/10 data-[kind=done]:border-status-success/50"
      >
        <HubStateIndicator kind={kind} />
        <HubAvatar agentType={target.agentType} kind={thread ? kind : null} />
        <span className="min-w-0 flex-1 text-[12px] leading-tight">
          <span className="block truncate font-semibold">{title}</span>
          <span className="block truncate [&>span]:text-[10.5px]">
            <HubCrumb location={location} />
          </span>
        </span>
        {chip.window.tabs.length > 1 ? (
          <Badge variant="secondary">
            {translate('agentHub.mirror.tabCount', '{{value0}} tabs', {
              value0: chip.window.tabs.length
            })}
          </Badge>
        ) : null}
        {/* The chip's controls sit close together, like the mirror header's. */}
        <span className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label={translate(
              'agentHub.mirror.jumpHint',
              'Jump to this terminal in its workspace'
            )}
            title={translate('agentHub.mirror.jumpHint', 'Jump to this terminal in its workspace')}
            onClick={() => onReveal()}
            className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
          >
            <ArrowUpRight className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label={translate('agentHub.mirror.close', 'Close mirror')}
            title={translate('agentHub.mirror.close', 'Close mirror')}
            onClick={onClose}
            className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </span>
      </div>
      {alert ? (
        <AgentHubAlertStack
          // The chip shows the newest alert across its entries.
          alerts={[alert]}
          anchorRef={chipRef}
          side={alertSide}
          locationOf={locationOfAlert ?? (() => location)}
          onOpen={onOpenAlert}
          onPopout={(shown) => {
            onDismissAlert(shown.id)
            openAgentHubMirror(
              paneTargetFromThread(shown.thread, activityThreadRowCopy(shown.thread).taskTitle)
            )
          }}
          onJump={(shown) => {
            onDismissAlert(shown.id)
            onReveal(shown)
          }}
          onDismiss={onDismissAlert}
        />
      ) : null}
    </>
  )
}

import { AgentHubActionTooltip } from './AgentHubShortcut'
import { Bell, BellOff, Ellipsis, Keyboard, PanelBottom, Settings } from 'lucide-react'
import { agentHubShortcutsLabel } from './AgentHubShortcutsDialog'
import { openAgentHubShortcuts } from './agent-hub-shortcuts-dialog'
import { useAppStore } from '@/store'
import { useOpenAgentHubSettings } from './AgentHubSettingsButton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import type { AgentHubDockEdge, AgentHubDockSize } from '../../../../shared/agent-hub-settings'
import { AgentHubAlertMuteItems } from './AgentHubAlertMuteItems'
import { agentHubDockPopoverSide } from './agent-hub-dock-geometry'

const EDGES: readonly AgentHubDockEdge[] = ['bottom', 'top', 'left', 'right']
export const AGENT_HUB_DOCK_SIZES: readonly AgentHubDockSize[] = ['small', 'medium', 'large']

export function agentHubDockSizeLabel(size: AgentHubDockSize): string {
  switch (size) {
    case 'small':
      return translate('agentHub.dock.sizeSmall', 'Small')
    case 'medium':
      return translate('agentHub.dock.sizeMedium', 'Medium')
    case 'large':
      return translate('agentHub.dock.sizeLarge', 'Large')
  }
}

function edgeLabel(edge: AgentHubDockEdge): string {
  switch (edge) {
    case 'bottom':
      return translate('agentHub.dock.edgeBottom', 'Above the status bar')
    case 'top':
      return translate('agentHub.dock.edgeTop', 'Below the title bar')
    case 'left':
      return translate('agentHub.dock.edgeLeft', 'Left edge')
    case 'right':
      return translate('agentHub.dock.edgeRight', 'Right edge')
  }
}

/** The dock's "···": mute, move, switch to the status bar, settings. */
export function AgentHubDockMenu({
  edge,
  size,
  muted,
  onOpenChange,
  buttonClassName
}: {
  edge: AgentHubDockEdge
  size: AgentHubDockSize
  muted: boolean
  onOpenChange: (open: boolean) => void
  buttonClassName: string
}): React.JSX.Element {
  const updateSettings = useAppStore((s) => s.updateSettings)
  const openAgentHubSettings = useOpenAgentHubSettings()
  const side = agentHubDockPopoverSide(edge)
  return (
    <DropdownMenu modal={false} onOpenChange={onOpenChange}>
      <AgentHubActionTooltip label={translate('agentHub.dock.more', 'More')}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={translate('agentHub.dock.more', 'More')}
            className={buttonClassName}
          >
            <Ellipsis className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
      </AgentHubActionTooltip>
      <DropdownMenuContent side={side} align="center" sideOffset={10} className="min-w-56">
        {muted ? (
          <DropdownMenuItem
            onSelect={() => void updateSettings({ agentHubAlertsMutedUntil: null })}
          >
            <Bell />
            {translate('agentHub.dock.unmute', 'Turn alerts back on')}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <BellOff />
            {translate('auto.agentHub.alerts.mute', 'Mute alerts')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <AgentHubAlertMuteItems updateSettings={updateSettings} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{translate('agentHub.dock.position', 'Position')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={edge}
          onValueChange={(value) => {
            const next = EDGES.find((candidate) => candidate === value)
            if (next) {
              void updateSettings({ agentHubDockPosition: { edge: next, offset: 0.5 } })
            }
          }}
        >
          {EDGES.map((candidate) => (
            <DropdownMenuRadioItem key={candidate} value={candidate}>
              {edgeLabel(candidate)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{translate('agentHub.dock.size', 'Size')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={size}
          onValueChange={(value) => {
            const next = AGENT_HUB_DOCK_SIZES.find((candidate) => candidate === value)
            if (next) {
              void updateSettings({ agentHubDockSize: next })
            }
          }}
        >
          {AGENT_HUB_DOCK_SIZES.map((candidate) => (
            <DropdownMenuRadioItem key={candidate} value={candidate}>
              {agentHubDockSizeLabel(candidate)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void updateSettings({ agentHubPlacement: 'status-bar' })}>
          <PanelBottom />
          {translate('agentHub.dock.useStatusBar', 'Show in the status bar instead')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={openAgentHubShortcuts}>
          <Keyboard />
          {agentHubShortcutsLabel()}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={openAgentHubSettings}>
          <Settings />
          {translate('agentHub.dock.settings', 'Agent Hub settings…')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

import { Bell, BellOff, Ellipsis, PanelBottom, Settings } from 'lucide-react'
import { useAppStore } from '@/store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import {
  AGENT_HUB_MUTE_DURATION_MS,
  type AgentHubDockEdge
} from '../../../../shared/agent-hub-settings'
import { clearAgentHubAlerts } from './agent-hub-alert-queue'

const EDGES: readonly AgentHubDockEdge[] = ['bottom', 'left', 'right']

function edgeLabel(edge: AgentHubDockEdge): string {
  switch (edge) {
    case 'bottom':
      return translate('agentHub.dock.edgeBottom', 'Above the status bar')
    case 'left':
      return translate('agentHub.dock.edgeLeft', 'Left edge')
    case 'right':
      return translate('agentHub.dock.edgeRight', 'Right edge')
  }
}

/** The dock's "···": mute, move, switch to the status bar, settings. */
export function AgentHubDockMenu({
  edge,
  muted,
  onOpenChange,
  buttonClassName
}: {
  edge: AgentHubDockEdge
  muted: boolean
  onOpenChange: (open: boolean) => void
  buttonClassName: string
}): React.JSX.Element {
  const updateSettings = useAppStore((s) => s.updateSettings)
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  const side = edge === 'bottom' ? 'top' : edge === 'right' ? 'left' : 'right'
  return (
    <DropdownMenu modal={false} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={translate('agentHub.dock.more', 'More')}
          className={buttonClassName}
        >
          <Ellipsis className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="center" sideOffset={10} className="min-w-56">
        <DropdownMenuItem
          onSelect={() => {
            if (!muted) {
              clearAgentHubAlerts()
            }
            void updateSettings({
              agentHubAlertsMutedUntil: muted ? null : Date.now() + AGENT_HUB_MUTE_DURATION_MS
            })
          }}
        >
          {muted ? <Bell /> : <BellOff />}
          {muted
            ? translate('agentHub.dock.unmute', 'Turn alerts back on')
            : translate('agentHub.dock.mute', 'Mute alerts for 2 hours')}
        </DropdownMenuItem>
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
        <DropdownMenuItem onSelect={() => void updateSettings({ agentHubPlacement: 'status-bar' })}>
          <PanelBottom />
          {translate('agentHub.dock.useStatusBar', 'Show in the status bar instead')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            openSettingsTarget({
              pane: 'experimental',
              repoId: null,
              sectionId: 'experimental-agent-hub'
            })
            openSettingsPage()
          }}
        >
          <Settings />
          {translate('agentHub.dock.settings', 'Agent Hub settings…')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

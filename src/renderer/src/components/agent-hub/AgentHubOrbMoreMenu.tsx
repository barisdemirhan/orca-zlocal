import {
  Eraser,
  Ellipsis,
  History,
  Maximize2,
  MessageSquarePlus,
  Moon,
  Settings
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { getShortcutPlatform } from '@/lib/keyboard/shortcut-platform'
import { formatKeybindingList } from '../../../../shared/keybindings/formatting'
import { AgentHubActionTooltip } from './AgentHubShortcut'

/** The ⋯ menu of both Orb windows: the bot-page entries first, then what the Orb window already had. */
export function AgentHubOrbMoreMenu({
  name,
  busy,
  botPage,
  onNew,
  onClearHome,
  onOpenPage,
  onBotSettings,
  onHistory,
  onOrbSettings,
  onSleep
}: {
  name: string
  busy: boolean
  /** The Orb bot's page entries show only while it exists. */
  botPage: boolean
  onNew: () => void
  onClearHome: () => void
  onOpenPage: () => void
  onBotSettings: () => void
  onHistory: () => void
  onOrbSettings?: () => void
  onSleep: () => void
}): React.JSX.Element {
  const label = translate('agentHub.orb.moreActions', 'More actions')
  return (
    <DropdownMenu modal={false}>
      <AgentHubActionTooltip label={label}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={label}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
      </AgentHubActionTooltip>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem disabled={busy} onSelect={onNew}>
          <MessageSquarePlus />
          {translate('agentHub.orb.menu.newChat', 'New chat')}
          <DropdownMenuShortcut>
            {formatKeybindingList(['Mod+N'], getShortcutPlatform())}
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        {botPage ? (
          <DropdownMenuItem disabled={busy} onSelect={onClearHome}>
            <Eraser />
            {translate('agentHub.orb.strip.clearHome', 'Clear home chat')}…
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem disabled={busy} onSelect={onHistory}>
          <History />
          {translate('auto.agentHub.orb.pastConversations', 'Past conversations')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {botPage ? (
          <>
            <DropdownMenuItem onSelect={onOpenPage}>
              <Maximize2 />
              {translate('agentHub.orb.menu.openPage', 'Open bot page')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onBotSettings}>
              <Settings />
              {translate('agentHub.orb.menu.botSettings', 'Bot settings')}
            </DropdownMenuItem>
          </>
        ) : null}
        {onOrbSettings ? (
          <DropdownMenuItem disabled={busy} onSelect={onOrbSettings}>
            <Settings />
            {translate('auto.agentHub.orb.settings', 'Orb settings')}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={busy} onSelect={onSleep}>
          <Moon />
          {translate('agentHub.orb.sleepNamed', 'Put {{name}} to sleep', { name })}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

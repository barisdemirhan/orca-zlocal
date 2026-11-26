import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { openAgentHubCanvas, useAgentHubCanvasOpen } from './agent-hub-canvas-store'
import { setAgentHubMirrorFocus } from './agent-hub-mirror-focus'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { openBotHome } from '@/lib/bot-catalog'
import { useAgentHubMirrorBotChat } from './agent-hub-mirror-bot-chat'
import { agentHubMirrorSourceKey } from './agent-hub-mirror-membership'
import { useAgentHubPaneSleep } from './agent-hub-pane-sleep'
import { useAgentHubPaneSleepConfirmation } from './agent-hub-pane-sleep-confirmation'
import {
  openAgentHubMirrorDrawer,
  setAgentHubMirrorStripShown,
  setAgentMayUseCard,
  useAgentHubMirrorAgentPref,
  useAgentHubMirrorStripShown,
  type AgentHubMirrorDrawer
} from './agent-hub-mirror-drawer-store'

function drawerLabels(): [AgentHubMirrorDrawer, string][] {
  return [
    ['work', translate('agentHub.mirror.drawer.work', 'Work')],
    ['inbound', translate('agentHub.mirror.drawer.inbound', 'Inbound')],
    ['changes', translate('agentHub.mirror.drawer.changes', 'Changes')],
    ['pr', translate('agentHub.mirror.drawer.pr', 'PR')],
    ['settings', translate('agentHub.mirror.drawer.settings', 'Settings')]
  ]
}

/** The mirror's ⋯ menu: the card's own switches beside the jump, dock, sleep and close actions. */
export function AgentHubMirrorMenu({
  target,
  mirrorKey,
  isAgent,
  showJump,
  onReveal,
  onMinimize,
  onClose
}: {
  target: AgentHubPaneTarget
  mirrorKey: string
  isAgent: boolean
  showJump: boolean
  onReveal: () => void
  onMinimize: () => void
  onClose: () => void
}): React.JSX.Element {
  const sourceKey = agentHubMirrorSourceKey(target)
  const stripShown = useAgentHubMirrorStripShown(sourceKey)
  const agentMay = useAgentHubMirrorAgentPref(sourceKey)
  const sleep = useAgentHubPaneSleep(target)
  const botChat = useAgentHubMirrorBotChat(target)
  const label = translate('agentHub.mirror.menu', 'Mirror menu')
  const canvasOpen = useAgentHubCanvasOpen()
  const canvasEnabled = useAppStore((s) => s.settings?.agentHubCanvas !== false)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground"
          aria-label={label}
          title={label}
        >
          <MoreHorizontal className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {showJump ? (
          <DropdownMenuItem onSelect={onReveal}>
            {translate('agentHub.mirror.menuJump', 'Jump to terminal')}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={onMinimize}>
          {translate('agentHub.mirror.menuDock', 'Dock')}
        </DropdownMenuItem>
        {canvasOpen || !canvasEnabled ? null : (
          <DropdownMenuItem
            onSelect={() => {
              openAgentHubCanvas(true)
              setAgentHubMirrorFocus(mirrorKey)
            }}
          >
            {translate('agentHub.mirror.menuCanvas', 'Move to canvas')}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {botChat ? (
          <>
            <DropdownMenuItem onSelect={() => openBotHome(botChat.bot)}>
              {translate('agentHub.mirror.bot.openPage', 'Open bot page')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => openAgentHubMirrorDrawer(sourceKey, 'settings', 'user')}
            >
              {translate('agentHub.mirror.bot.settings', 'Bot settings')}
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuCheckboxItem
              checked={stripShown}
              onCheckedChange={(checked) => setAgentHubMirrorStripShown(sourceKey, checked)}
            >
              {translate('agentHub.mirror.menuStrip', 'Show work strip')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {translate('agentHub.mirror.menuDrawer', 'Open drawer')}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {drawerLabels().map(([drawer, text]) => (
                  <DropdownMenuItem
                    key={drawer}
                    onSelect={() => openAgentHubMirrorDrawer(sourceKey, drawer, 'user')}
                  >
                    {text}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
        {isAgent ? (
          <DropdownMenuCheckboxItem
            checked={agentMay}
            onCheckedChange={(checked) => setAgentMayUseCard(sourceKey, checked)}
          >
            {translate('agentHub.mirror.menuAgentCard', 'Let this agent use its card')}
          </DropdownMenuCheckboxItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!sleep.canSleep}
          onSelect={() => useAgentHubPaneSleepConfirmation.getState().request(target)}
        >
          {translate('agentHub.sleep.action', 'Sleep')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onClose}>
          {translate('agentHub.mirror.closeTab', 'Close tab')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

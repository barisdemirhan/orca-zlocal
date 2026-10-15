import { Keyboard } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { AgentHubShortcutSetting } from './AgentHubShortcutSetting'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { AgentHubActionTooltip } from './AgentHubShortcut'
import {
  openAgentHubShortcuts,
  setAgentHubShortcutsOpen,
  useAgentHubShortcutsOpen
} from './agent-hub-shortcuts-dialog'

export function agentHubShortcutsLabel(): string {
  return translate('agentHub.shortcuts.title', 'Keyboard shortcuts')
}

export function AgentHubShortcutsButton(): React.JSX.Element {
  return (
    <AgentHubActionTooltip label={agentHubShortcutsLabel()}>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={agentHubShortcutsLabel()}
        onClick={openAgentHubShortcuts}
      >
        <Keyboard />
      </Button>
    </AgentHubActionTooltip>
  )
}

export function AgentHubShortcutsDialog(): React.JSX.Element {
  const open = useAgentHubShortcutsOpen()
  return (
    <Dialog open={open} onOpenChange={setAgentHubShortcutsOpen}>
      <DialogContent className="max-h-[calc(100vh-2rem)]">
        <div className="min-h-0 space-y-4 overflow-y-auto scrollbar-sleek">
          <DialogHeader>
            <DialogTitle>{agentHubShortcutsLabel()}</DialogTitle>
            <DialogDescription>
              {translate(
                'agentHub.shortcuts.editDescription',
                'Change shortcuts for the Hub, Orb, mirrors and dictation.'
              )}
            </DialogDescription>
          </DialogHeader>
          {open ? <AgentHubShortcutSetting /> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

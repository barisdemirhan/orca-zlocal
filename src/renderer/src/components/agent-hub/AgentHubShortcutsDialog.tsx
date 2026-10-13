import { Keyboard } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { KEYBINDING_DEFINITIONS, isKeybindingActionId } from '../../../../shared/keybindings'
import { formatShortcutKeyComboDetails } from '@/hooks/useShortcutLabel'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { AgentHubActionTooltip, AgentHubShortcut } from './AgentHubShortcut'
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

function actionLabel(id: string, fallback: string): string {
  switch (id) {
    case 'agentHub.toggleOrb':
      return translate('auto.agentHub.orb.toggle', 'Toggle Agent Hub Orb')
    case 'agentHub.toggle':
      return translate('agentHub.shortcuts.toggle', 'Open or close the hub')
    case 'agentHub.nextWaiting':
      return translate('agentHub.shortcuts.nextWaiting', 'Jump to the next waiting agent')
    case 'agentHub.dockMirrors':
      return translate('agentHub.shortcuts.dockMirrors', 'Park or restore mirrors')
    case 'agentHub.popOut':
      return translate('agentHub.shortcuts.popOut', 'Pop out the active agent')
    case 'agentHub.jumpToMirror':
      return translate('agentHub.shortcuts.jumpToMirror', 'Jump to the active mirror’s workspace')
    case 'agentHub.arrangeMirrors':
      return translate('agentHub.shortcuts.arrangeMirrors', 'Arrange mirrors')
    case 'agentHub.toggleCanvas':
      return translate('agentHub.shortcuts.toggleCanvas', 'Open or leave the canvas')
    case 'agentHub.focusMirror':
      return translate(
        'agentHub.shortcuts.focusMirror',
        'Focus or unfocus the active canvas mirror'
      )
    case 'voice.dictation':
      return translate('agentHub.mic.dictate', 'Dictate')
    case 'voice.dictationImprove':
      return translate('agentHub.mic.improve', 'Dictate and improve')
    default:
      return fallback
  }
}

export function AgentHubShortcutsDialog(): React.JSX.Element {
  const open = useAgentHubShortcutsOpen()
  const bindings = useAppStore((s) => s.keybindings)
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  const groups = [
    {
      title: translate('agentHub.shortcuts.hub', 'Hub'),
      matches: (id: string) => !id.startsWith('voice.') && !/Mirrors?$|Canvas$|\.popOut$/.test(id)
    },
    {
      title: translate('agentHub.shortcuts.mirrors', 'Mirrors'),
      matches: (id: string) => /Mirrors?$|\.popOut$/.test(id) && id !== 'agentHub.focusMirror'
    },
    {
      title: translate('agentHub.shortcuts.canvas', 'Canvas'),
      matches: (id: string) => id === 'agentHub.toggleCanvas' || id === 'agentHub.focusMirror'
    },
    {
      title: translate('agentHub.shortcuts.dictation', 'Dictation'),
      matches: (id: string) => id.startsWith('voice.')
    }
  ]
  const voiceActions = new Set(['voice.dictation', 'voice.dictationImprove'])
  const actions = KEYBINDING_DEFINITIONS.filter(
    (action) => action.id.startsWith('agentHub.') || voiceActions.has(action.id)
  )
  const configure = (): void => {
    setAgentHubShortcutsOpen(false)
    openSettingsTarget({ pane: 'agentHub', repoId: null })
    openSettingsPage()
  }
  return (
    <Dialog open={open} onOpenChange={setAgentHubShortcutsOpen}>
      <DialogContent className="max-h-[calc(100vh-2rem)]">
        <div className="min-h-0 space-y-4 overflow-y-auto scrollbar-sleek">
          <DialogHeader>
            <DialogTitle>{agentHubShortcutsLabel()}</DialogTitle>
            <DialogDescription>
              {translate(
                'agentHub.shortcut.doubleTapHint',
                'You can also record a double tap of a modifier key.'
              )}
            </DialogDescription>
          </DialogHeader>
          {groups.map((group) => {
            const rows = actions.filter((action) => group.matches(action.id))
            if (rows.length === 0) {
              return null
            }
            return (
              <section key={group.title} className="min-w-0 space-y-2" aria-label={group.title}>
                <h3 className="text-xs font-semibold text-muted-foreground">{group.title}</h3>
                {rows.map((action) => {
                  const bound =
                    isKeybindingActionId(action.id) &&
                    formatShortcutKeyComboDetails(action.id, bindings).length > 0
                  return (
                    <div
                      key={action.id}
                      data-agent-hub-shortcut-help={action.id}
                      className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 basis-40">
                        {actionLabel(action.id, action.title)}
                      </span>
                      {bound ? (
                        <AgentHubShortcut actionId={action.id} />
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {translate('agentHub.shortcuts.notSet', 'Not set')}
                          </span>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={configure}
                            aria-label={translate(
                              'agentHub.shortcuts.setAction',
                              'Set shortcut for {{action}}',
                              { action: actionLabel(action.id, action.title) }
                            )}
                          >
                            {translate('agentHub.shortcuts.set', 'Set shortcut')}
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </section>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

import { createContext, useContext } from 'react'
import { PictureInPicture2 } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/workspace/identity/floating-workspace-id'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { AgentHubShortcut } from './AgentHubShortcut'
import { popOutAgentHubTab } from './agent-hub-tab-popout'
import { paneTargetFromTerminalRow } from './agent-hub-pane-target'
import { agentHubRowOfTab } from './agent-hub-tab-row'
import { agentHubTerminalTreeFromState } from './use-agent-hub-terminal-tree'

const FloatingPanelOpenChange = createContext<((open: boolean) => void) | null>(null)
const NO_PARENTS: ReadonlyMap<string, string> = new Map()

export function AgentHubFloatingPopoutProvider({
  onOpenChange,
  children
}: {
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}): React.JSX.Element {
  const enabled = useAppStore((s) => s.settings?.experimentalAgentHub === true)
  return (
    <FloatingPanelOpenChange value={enabled ? onOpenChange : null}>
      {children}
    </FloatingPanelOpenChange>
  )
}

export function AgentHubTabPopout({
  tabId,
  worktreeId
}: {
  tabId: string
  worktreeId: string
}): React.JSX.Element | null {
  const onOpenChange = useContext(FloatingPanelOpenChange)
  const shown = useAppStore(
    (s) => s.settings?.experimentalAgentHub === true && s.settings.agentHubTabAutoPopout === true
  )
  if (!shown || (worktreeId === FLOATING_TERMINAL_WORKTREE_ID && !onOpenChange)) {
    return null
  }
  const label = translate('agentHub.row.popOut', 'Pop out')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          data-agent-hub-tab-popout
          className="relative z-10 mr-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm text-transparent group-hover:text-muted-foreground group-focus-within:text-muted-foreground hover:bg-muted hover:!text-foreground focus-visible:bg-muted focus-visible:!text-foreground"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onAuxClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.stopPropagation()
            const state = useAppStore.getState()
            if (state.settings?.experimentalAgentHub !== true) {
              return
            }
            const row = agentHubRowOfTab(
              agentHubTerminalTreeFromState(state, [], true, NO_PARENTS),
              tabId
            )
            if (!row || row.worktree.id !== worktreeId) {
              return
            }
            popOutAgentHubTab(paneTargetFromTerminalRow(row))
            if (worktreeId === FLOATING_TERMINAL_WORKTREE_ID) {
              onOpenChange?.(false)
            }
          }}
        >
          <PictureInPicture2 className="size-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        <span className="flex items-center gap-2">
          {label}
          <AgentHubShortcut actionId="agentHub.popOut" />
        </span>
      </TooltipContent>
    </Tooltip>
  )
}

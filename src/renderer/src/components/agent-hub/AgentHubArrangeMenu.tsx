import { AgentHubShortcut } from './AgentHubShortcut'
import { Columns3, LayoutGrid, Rows3 } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import {
  normalizeAgentHubFloatingLayout,
  type AgentHubFloatingLayout
} from '../../../../shared/agent-hub-settings'
import { arrangeAgentHubFloatingWindowsOnScreen } from './agent-hub-floating-arrangement'
import { useMenuOpeningClickGuard } from './use-menu-opening-click-guard'

const LAYOUTS: readonly AgentHubFloatingLayout[] = ['grid', 'columns', 'rows']

function LayoutLabel({ layout }: { layout: AgentHubFloatingLayout }): React.JSX.Element {
  switch (layout) {
    case 'grid':
      return (
        <>
          <LayoutGrid />
          {translate('agentHub.arrange.grid', 'In a grid')}
        </>
      )
    case 'columns':
      return (
        <>
          <Columns3 />
          {translate('agentHub.arrange.columns', 'Side by side')}
        </>
      )
    case 'rows':
      return (
        <>
          <Rows3 />
          {translate('agentHub.arrange.rows', 'Stacked')}
        </>
      )
  }
}

/**
 * Right-click on the hub's Arrange button: lay every floating window (mirrors and the floating
 * workspace) out evenly between the sidebars. The layout picked becomes the default, used when
 * mirrors are brought back or popped out together.
 */
export function AgentHubArrangeMenu({
  children,
  onOpenChange
}: {
  children: React.ReactNode
  onOpenChange?: (open: boolean) => void
}): React.JSX.Element {
  const layout = useAppStore((s) =>
    normalizeAgentHubFloatingLayout(s.settings?.agentHubFloatingLayout)
  )
  const updateSettings = useAppStore((s) => s.updateSettings)
  const openingClick = useMenuOpeningClickGuard()
  return (
    <ContextMenu
      onOpenChange={(open) => {
        openingClick.noteOpenChange(open)
        onOpenChange?.(open)
      }}
    >
      <ContextMenuTrigger asChild>
        <span className="contents">{children}</span>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-max min-w-80 max-w-[calc(100vw-2rem)]" collisionPadding={8}>
        <ContextMenuLabel className="whitespace-nowrap">
          {translate('agentHub.arrange.title', 'Arrange floating windows')}
        </ContextMenuLabel>
        {/* Why onSelect: picking the layout already in use should still lay the windows out. */}
        <ContextMenuRadioGroup value={layout}>
          {LAYOUTS.map((option) => (
            <ContextMenuRadioItem
              key={option}
              value={option}
              className="whitespace-nowrap"
              onSelect={(event) => {
                if (openingClick.isOpeningClick()) {
                  event.preventDefault()
                  return
                }
                void updateSettings({ agentHubFloatingLayout: option })
                arrangeAgentHubFloatingWindowsOnScreen(option)
              }}
            >
              <LayoutLabel layout={option} />
              {option === layout ? (
                <AgentHubShortcut actionId="agentHub.arrangeMirrors" slot="context" />
              ) : null}
            </ContextMenuRadioItem>
          ))}
        </ContextMenuRadioGroup>
      </ContextMenuContent>
    </ContextMenu>
  )
}

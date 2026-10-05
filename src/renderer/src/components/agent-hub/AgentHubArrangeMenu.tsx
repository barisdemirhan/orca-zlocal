import { useRef } from 'react'
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

const LAYOUTS: readonly AgentHubFloatingLayout[] = ['grid', 'columns', 'rows']
// Releasing the right button over the menu it just opened must not pick an item.
const OPENING_CLICK_MS = 350

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
 * Right-click on the hub's mirror controls: lay every floating window (mirrors and the floating
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
  const openedAtRef = useRef(0)
  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open) {
          openedAtRef.current = performance.now()
        }
        onOpenChange?.(open)
      }}
    >
      <ContextMenuTrigger asChild>
        <span className="contents">{children}</span>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel>
          {translate('agentHub.arrange.title', 'Arrange floating windows')}
        </ContextMenuLabel>
        {/* Why onSelect: picking the layout already in use should still lay the windows out. */}
        <ContextMenuRadioGroup value={layout}>
          {LAYOUTS.map((option) => (
            <ContextMenuRadioItem
              key={option}
              value={option}
              onSelect={(event) => {
                if (performance.now() - openedAtRef.current < OPENING_CLICK_MS) {
                  event.preventDefault()
                  return
                }
                void updateSettings({ agentHubFloatingLayout: option })
                arrangeAgentHubFloatingWindowsOnScreen(option)
              }}
            >
              <LayoutLabel layout={option} />
            </ContextMenuRadioItem>
          ))}
        </ContextMenuRadioGroup>
      </ContextMenuContent>
    </ContextMenu>
  )
}

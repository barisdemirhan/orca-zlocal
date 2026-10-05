import { Columns3, LayoutGrid, Rows3 } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useOptionalShortcutLabel } from '@/hooks/useShortcutLabel'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import {
  normalizeAgentHubFloatingLayout,
  type AgentHubFloatingLayout
} from '../../../../shared/agent-hub-settings'
import { arrangeAgentHubFloatingWindowsOnScreen } from './agent-hub-floating-arrangement'

function isLayout(value: string): value is AgentHubFloatingLayout {
  return value === 'grid' || value === 'columns' || value === 'rows'
}

/**
 * The canvas's quick layout switch: one click lays the mirrors out and makes that layout the
 * default, the same choice the mirrors button offers on right-click.
 */
export function AgentHubCanvasLayoutSwitch(): React.JSX.Element {
  const layout = useAppStore((s) =>
    normalizeAgentHubFloatingLayout(s.settings?.agentHubFloatingLayout)
  )
  const updateSettings = useAppStore((s) => s.updateSettings)
  const arrangeShortcut = useOptionalShortcutLabel('agentHub.arrangeMirrors')
  // The shortcut lays out again in the layout in use, so that layout's button names it.
  const hint = (option: AgentHubFloatingLayout, label: string): string =>
    option === layout && arrangeShortcut ? `${label} (${arrangeShortcut})` : label
  return (
    <div className="absolute right-3 bottom-3 rounded-md bg-popover shadow-floating">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={layout}
        aria-label={translate('agentHub.arrange.title', 'Arrange floating windows')}
        // Why the fallback: a click on the layout in use sends '', and should lay out again.
        onValueChange={(value) => {
          const next = isLayout(value) ? value : layout
          if (next !== layout) {
            void updateSettings({ agentHubFloatingLayout: next })
          }
          arrangeAgentHubFloatingWindowsOnScreen(next)
        }}
      >
        <ToggleGroupItem
          value="grid"
          aria-label={translate('agentHub.arrange.grid', 'In a grid')}
          title={hint('grid', translate('agentHub.arrange.grid', 'In a grid'))}
        >
          <LayoutGrid />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="columns"
          aria-label={translate('agentHub.arrange.columns', 'Side by side')}
          title={hint('columns', translate('agentHub.arrange.columns', 'Side by side'))}
        >
          <Columns3 />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="rows"
          aria-label={translate('agentHub.arrange.rows', 'Stacked')}
          title={hint('rows', translate('agentHub.arrange.rows', 'Stacked'))}
        >
          <Rows3 />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}

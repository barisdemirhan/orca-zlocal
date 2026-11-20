import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import type {
  AgentSessionPluginPane,
  AgentSessionPluginUiPress
} from '../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import { NativeChatPluginTree } from './NativeChatPluginTree'

/** The pane a mod keeps beside the chat; a column when the chat is wide, a block above the composer when narrow. */
export function NativeChatPluginPane({
  pane,
  onPress
}: {
  pane: AgentSessionPluginPane
  onPress: (press: AgentSessionPluginUiPress) => void
}): React.JSX.Element {
  const t = useTranslate()
  const [collapsed, setCollapsed] = useState(false)
  const label = collapsed
    ? t('components.native-chat.pluginPane.expand', 'Expand pane')
    : t('components.native-chat.pluginPane.collapse', 'Collapse pane')
  const Chevron = collapsed ? ChevronRight : ChevronDown
  return (
    <section
      aria-label={pane.title}
      className="flex min-h-0 shrink-0 flex-col border-t border-chat-composer-border @2xl:w-80 @2xl:border-t-0 @2xl:border-l"
    >
      <header className="flex items-center gap-1 px-2 py-1 text-xs text-chat-foreground-faint">
        <Button
          type="button"
          variant="chat-tool"
          size="icon-xs"
          aria-label={label}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          <Chevron />
        </Button>
        <span className="min-w-0 truncate">{pane.title}</span>
      </header>
      {collapsed ? null : (
        <div className="scrollbar-sleek max-h-60 min-h-0 overflow-auto px-3 pb-2 font-mono text-chat-code text-chat-foreground @2xl:max-h-none @2xl:flex-1">
          <NativeChatPluginTree
            node={pane.tree}
            target={{ component: 'Pane', instanceId: pane.id }}
            onPress={onPress}
          />
        </div>
      )}
    </section>
  )
}

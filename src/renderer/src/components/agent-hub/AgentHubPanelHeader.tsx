import { X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { AgentHubInboxSideSwitch } from './AgentHubInboxSideSwitch'
import { AgentHubSettingsButton } from './AgentHubSettingsButton'
import { HubNestedCount } from './AgentHubSectionHeader'
import { AgentHubShortcutsButton } from './AgentHubShortcutsDialog'
import { AgentHubTabSwitcher } from './AgentHubTabSwitcher'
import type { AgentHubInboxModel } from './agent-hub-inbox-model'
import type { AgentHubTab } from './agent-hub-keys'
import {
  updateAgentHubPanelListState,
  type AgentHubInboxSideChoice
} from './agent-hub-panel-list-state'

export function AgentHubPanelHeader({
  tab,
  tabOptions,
  counts,
  nestedWorking,
  inbox,
  side,
  onTab,
  onClose
}: {
  tab: AgentHubTab
  tabOptions: readonly { value: AgentHubTab; label: string }[]
  counts: Record<AgentHubTab, number>
  nestedWorking: number
  inbox: AgentHubInboxModel
  side: AgentHubInboxSideChoice
  onTab: (tab: AgentHubTab) => void
  onClose: () => void
}): React.JSX.Element {
  return (
    <div className="flex shrink-0 items-center gap-3 pt-3.5 pr-3.5 pb-2.5 pl-4.5">
      <h2 className="shrink-0 text-sm font-semibold">{translate('agentHub.title', 'Agents')}</h2>
      <AgentHubTabSwitcher
        tabs={tabOptions}
        value={tab}
        onChange={onTab}
        askValue={inbox.counts.inbox > 0 ? 'inbox' : undefined}
        counts={{
          ...counts,
          running: (
            <>
              {counts.running}
              <HubNestedCount value={nestedWorking} />
            </>
          )
        }}
      />
      {tab === 'inbox' ? (
        <AgentHubInboxSideSwitch
          choice={side}
          botsActive={inbox.botsActive}
          botAsks={inbox.counts.botAsks}
          agentAsks={inbox.counts.agentAsks}
          onChoice={(next) => updateAgentHubPanelListState({ side: next })}
        />
      ) : null}
      <AgentHubShortcutsButton />
      <AgentHubSettingsButton onOpened={onClose} />
      <button
        type="button"
        tabIndex={-1}
        aria-label={translate('agentHub.close', 'Close (esc)')}
        onClick={onClose}
        className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

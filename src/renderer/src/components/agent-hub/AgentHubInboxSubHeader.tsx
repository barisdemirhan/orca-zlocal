import { ArrowUpDown, ListChecks } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { openAgentHubAnswerQueue } from './agent-hub-answer-queue-store'
import type { AgentHubInboxSort } from './agent-hub-inbox-groups'
import {
  updateAgentHubPanelListState,
  useAgentHubPanelListState
} from './agent-hub-panel-list-state'
import { useAgentHubSurfaceSetting } from './use-agent-hub-surface-setting'

function SubButton({
  children,
  onClick,
  label
}: {
  children: React.ReactNode
  onClick?: () => void
  label?: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      onClick={onClick}
      className="flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs whitespace-nowrap text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
    >
      {children}
    </button>
  )
}

function SortGroup({
  label,
  value,
  onChange
}: {
  label: string
  value: AgentHubInboxSort
  onChange: (value: AgentHubInboxSort) => void
}): React.JSX.Element {
  return (
    <>
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={value}
        onValueChange={(next) => onChange(next as AgentHubInboxSort)}
      >
        <DropdownMenuRadioItem value="longest">
          {translate('agentHub.inbox.sort.longest', 'Waiting longest')}
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="newest">
          {translate('agentHub.inbox.sort.newest', 'Newest')}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </>
  )
}

/** Under the tabs on the Inbox: box order, the answer queue, mark all read and sorting. */
export function AgentHubInboxSubHeader({
  botsActive,
  waiting,
  finishedKeys,
  onMarkRead
}: {
  botsActive: boolean
  waiting: number
  finishedKeys: string[]
  onMarkRead: (paneKeys: string[]) => void
}): React.JSX.Element {
  const order = useAgentHubSurfaceSetting('agentHubInboxOrder')
  const updateSettings = useAppStore((state) => state.updateSettings)
  const { side, sortOrder, sortWithin } = useAgentHubPanelListState()
  const sideLabel =
    side === 'bots'
      ? translate('agentHub.inbox.botsOnly', 'Bots only')
      : translate('agentHub.inbox.agentsOnly', 'Agents only')
  return (
    <div
      data-agent-hub-inbox-subheader
      className="@container flex shrink-0 flex-wrap items-center gap-x-1 px-3.5 pb-1.5 text-xs text-muted-foreground"
    >
      {botsActive && side === 'both' ? (
        <SubButton
          onClick={() =>
            void updateSettings({
              agentHubInboxOrder: order === 'bots-first' ? 'agents-first' : 'bots-first'
            })
          }
        >
          {order === 'bots-first'
            ? translate('agentHub.inbox.botsFirst', 'Bots first')
            : translate('agentHub.inbox.agentsFirst', 'Agents first')}
        </SubButton>
      ) : null}
      {botsActive && side !== 'both' ? (
        <span className="flex items-center gap-1.5 px-1.5">
          {sideLabel}
          <button
            type="button"
            tabIndex={-1}
            onClick={() => updateAgentHubPanelListState({ side: 'both' })}
            className="font-medium text-foreground hover:underline"
          >
            {translate('agentHub.inbox.showAll', 'Show all')}
          </button>
        </span>
      ) : null}
      {waiting > 0 ? (
        <SubButton onClick={openAgentHubAnswerQueue}>
          <ListChecks aria-hidden className="size-3.5" />
          {translate('agentHub.inbox.answerQueue', 'Answer queue')}
        </SubButton>
      ) : null}
      <span className="flex-1" />
      {finishedKeys.length > 0 ? (
        <SubButton onClick={() => onMarkRead(finishedKeys)}>
          {translate('agentHub.inbox.markAllRead', 'Mark all read')}
        </SubButton>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SubButton label={translate('agentHub.inbox.sort.label', 'Sort')}>
            <ArrowUpDown aria-hidden className="size-3.5" />
            <span className="@max-[420px]:hidden">
              {translate('agentHub.inbox.sort.label', 'Sort')}
            </span>
          </SubButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <SortGroup
            label={translate('agentHub.inbox.sort.order', 'Order')}
            value={sortOrder}
            onChange={(value) => updateAgentHubPanelListState({ sortOrder: value })}
          />
          <DropdownMenuSeparator />
          <SortGroup
            label={translate('agentHub.inbox.sort.within', 'Within')}
            value={sortWithin}
            onChange={(value) => updateAgentHubPanelListState({ sortWithin: value })}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

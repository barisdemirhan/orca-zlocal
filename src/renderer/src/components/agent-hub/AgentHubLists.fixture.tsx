import { acceptedAgentStatuses } from '@/store/slices/agent-status/status-ownership/accepted-agent-statuses'
import { defineFixture } from '../../component-fixtures/component-fixture'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import type { Bot } from '../../../../shared/bot-types'
import { makePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import { buildActivityEvents } from '../activity/events/activity-event-builder'
import { AgentHubTerminalTree } from './AgentHubTerminalTree'
import {
  makeRepo,
  makeTabWithIds,
  makeThreads,
  makeWorktreeWithId
} from './agent-hub-activity-test-fixtures'
import { EMPTY_AGENT_HUB_LINEAGE } from './agent-hub-lineage'
import { buildAgentHubTerminalTree, agentOnlyAgentHubTree } from './agent-hub-terminal-tree'
import {
  splitAgentHubBotChats,
  tallyAgentHubBotChats,
  agentHubRowIsIdleAgent,
  foldAgentHubIdleRows
} from './agent-hub-tree-bot-groups'
import { sortAgentHubTerminalTree } from './agent-hub-terminal-tree-sort'
import {
  filterAgentHubTerminalTree,
  filterAgentHubTerminalTreeRows
} from './agent-hub-terminal-tree-view'
import { groupAgentHubSleepingRows } from './agent-hub-sleeping-groups'
import { AgentHubRunningView } from './AgentHubRunningBody'
import { AgentHubStateChips } from './AgentHubStateChips'
import {
  applyAgentHubStateGroupFilter,
  agentHubRowMatchesState,
  useAgentHubStateCounts,
  type AgentHubStateFilter
} from './agent-hub-state-filter'
import { agentHubIndicatorKind } from './agent-hub-lists'

const no = (): void => {}
const NOW = Date.now()
const scotty = { id: 'scotty', name: 'Scotty', hostId: 'local' } as unknown as Bot

const repoApp = { ...makeRepo(), id: 'repo-app', displayName: 'northwind-app' }
const repoApi = { ...makeRepo(), id: 'repo-api', displayName: 'northwind-api' }
const wtApp = { ...makeWorktreeWithId('wt-app', repoApp.id, 'feat/billing'), linkedPR: 412 }
const wtApi = makeWorktreeWithId('wt-api', repoApi.id, 'main')
const wtBotWork = makeWorktreeWithId('wt-bot-work', repoApp.id, 'scotty/fix-tests')
const wtHome = makeWorktreeWithId('wt-scotty-home', repoApi.id, 'Scotty')

type Spec = {
  tab: string
  worktree: string
  title: string
  state: AgentStatusEntry['state']
  read?: boolean
}
const SPECS: Spec[] = [
  { tab: 'a1', worktree: wtApp.id, title: 'Add the invoice export', state: 'working' },
  { tab: 'a2', worktree: wtApp.id, title: 'Plan the billing migration', state: 'waiting' },
  { tab: 'a3', worktree: wtApp.id, title: 'Rename the store files', state: 'done', read: true },
  { tab: 'a4', worktree: wtApp.id, title: 'Draft the changelog', state: 'done', read: true },
  { tab: 's1', worktree: wtApi.id, title: 'Spike the cache layer', state: 'done', read: true },
  { tab: 'p1', worktree: wtApi.id, title: 'Fix the flaky queue test', state: 'working' },
  { tab: 'b1', worktree: wtBotWork.id, title: 'Repair the failing specs', state: 'working' },
  { tab: 'h1', worktree: wtHome.id, title: 'Home chat', state: 'done' },
  { tab: 'h2', worktree: wtHome.id, title: 'Side chat: release notes', state: 'working' }
]
const IDLE_TABS = new Set(['i1', 'i2'])
const LEAF = (n: number): string => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`

function build(botsOn: boolean): {
  tree: ReturnType<typeof buildAgentHubTerminalTree>
  threads: ReturnType<typeof makeThreads>
} {
  const tabsByWorktree: Record<string, ReturnType<typeof makeTabWithIds>[]> = {}
  const entries: [string, AgentStatusEntry][] = []
  const acknowledged: Record<string, number> = {}
  SPECS.forEach((spec, index) => {
    const paneKey = makePaneKey(spec.tab, LEAF(index))
    if (spec.read) {
      acknowledged[paneKey] = NOW
    }
    ;(tabsByWorktree[spec.worktree] ??= []).push(
      makeTabWithIds(spec.tab, spec.worktree, spec.title)
    )
    entries.push([
      paneKey,
      {
        state: spec.state,
        prompt: spec.title,
        updatedAt: NOW - (index + 1) * 120_000,
        stateStartedAt: NOW - (index + 1) * 120_000,
        paneKey,
        terminalTitle: spec.title,
        stateHistory: [],
        agentType: index % 2 === 0 ? 'claude' : 'codex'
      } satisfies AgentStatusEntry
    ])
  })
  ;(tabsByWorktree[wtApp.id] ??= []).push(makeTabWithIds('i1', wtApp.id, 'Scratch shell'))
  ;(tabsByWorktree[wtApi.id] ??= []).push(makeTabWithIds('i2', wtApi.id, 'Notes'))
  const worktrees = [wtApp, wtApi, wtBotWork, wtHome]
  const threads = makeThreads(
    buildActivityEvents({
      chatNames: new Map(),
      agentStatusByPaneKey: acceptedAgentStatuses(entries),
      tabsByWorktree,
      worktreeMap: new Map(worktrees.map((w) => [w.id, w])),
      repoMap: new Map([repoApp, repoApi].map((r) => [r.id, r])),
      acknowledgedAgentsByPaneKey: acknowledged,
      now: NOW
    })
  )
  const tree = buildAgentHubTerminalTree({
    projectGroups: [],
    repos: [repoApp, repoApi],
    worktreesByRepo: {
      [repoApp.id]: [wtApp, wtBotWork],
      [repoApi.id]: [wtApi, wtHome]
    },
    folderWorkspaces: [],
    tabsByWorktree,
    threads,
    floating: null,
    includeShells: false,
    ungroupedLabel: 'Ungrouped',
    unknownProjectLabel: 'Unknown',
    botsGroupLabel: 'Bots',
    idleAgentOf: (tab) => (IDLE_TABS.has(tab.id) ? 'claude' : null),
    botOf: botsOn
      ? (worktree) =>
          worktree.id === wtHome.id
            ? { bot: scotty, home: true }
            : worktree.id === wtBotWork.id
              ? { bot: scotty, home: false }
              : null
      : undefined
  })
  return { tree, threads }
}

const order = { sortBy: 'repo' as const, workspaceRank: new Map<string, number>(), now: NOW }

const SLEEPING_TAB = 's1'

function Tree({
  mode,
  botsOn,
  query = '',
  idleOpen = false,
  sleeping = false,
  stateFilter = 'all'
}: {
  mode: 'agents' | 'all'
  botsOn: boolean
  query?: string
  idleOpen?: boolean
  sleeping?: boolean
  stateFilter?: AgentHubStateFilter
}): React.JSX.Element {
  const { tree } = build(botsOn)
  const split = splitAgentHubBotChats(tree)
  const base = mode === 'agents' ? agentOnlyAgentHubTree(split.rest) : tree
  const grouped = sleeping
    ? groupAgentHubSleepingRows(base, (target) => target.tab.id === SLEEPING_TAB)
    : base
  const counts = useAgentHubStateCounts(base, 'any')
  const stated = applyAgentHubStateGroupFilter(grouped, stateFilter)
  const matched = filterAgentHubTerminalTree(stated, query)
  const sorted = sortAgentHubTerminalTree(
    stateFilter === 'all' || stateFilter === 'sleep'
      ? matched
      : filterAgentHubTerminalTreeRows(matched, (row) => agentHubRowMatchesState(row, stateFilter)),
    order
  )
  const openKeys = new Set(
    idleOpen ? sorted.flatMap((group) => group.workspaces.map((workspace) => workspace.key)) : []
  )
  const groups =
    mode === 'agents' && !query && stateFilter === 'all'
      ? foldAgentHubIdleRows(sorted, openKeys, agentHubRowIsIdleAgent)
      : sorted
  return (
    <div className="bg-popover p-2.5">
      <AgentHubTerminalTree
        groups={groups}
        totalCount={groups.reduce((sum, group) => sum + group.rowCount, 0)}
        query={query}
        onQueryChange={no}
        searchRef={{ current: null }}
        sortBy="repo"
        onSortChange={no}
        collapseOverrides={new Map()}
        onToggleGroup={no}
        selectedKey={null}
        now={NOW}
        lineage={EMPTY_AGENT_HUB_LINEAGE}
        expandedKeys={new Set()}
        onOpen={no}
        onPopout={no}
        onJump={no}
        stateFiltered={stateFilter !== 'all'}
        filterBar={<AgentHubStateChips value={stateFilter} counts={counts} onChange={no} />}
        foldSleeping
        onToggleIdle={no}
        botChats={
          mode === 'agents' && botsOn
            ? { tallies: tallyAgentHubBotChats(split.botGroup), onOpenBots: no }
            : undefined
        }
        windowFilter={{
          value: 'any',
          onChange: no,
          toggles: { unreadOnly: false, botStartedOnly: false, botsAvailable: botsOn, onChange: no }
        }}
      />
    </div>
  )
}

function Running({ empty, botsOn }: { empty: boolean; botsOn: boolean }): React.JSX.Element {
  const { threads } = build(botsOn)
  const working = empty ? [] : threads.filter((thread) => agentHubIndicatorKind(thread) === 'work')
  return (
    <div className="bg-popover p-2.5">
      <AgentHubRunningView
        working={working}
        botOf={
          botsOn
            ? (worktree) =>
                worktree.id === wtHome.id
                  ? { bot: scotty, home: true }
                  : worktree.id === wtBotWork.id
                    ? { bot: scotty, home: false }
                    : null
            : undefined
        }
        botRuns={
          botsOn && !empty
            ? [
                {
                  key: 'run-1',
                  bot: scotty,
                  title: 'Look around',
                  at: NOW - 90_000,
                  sessionId: null
                }
              ]
            : []
        }
        nestedWorking={0}
        now={NOW}
        lineage={EMPTY_AGENT_HUB_LINEAGE}
        expandedKeys={new Set()}
        actions={{
          locationOf: (thread) => ({
            group: null,
            project: thread.repo?.displayName ?? '',
            workspace: thread.worktree.displayName
          }),
          isSelected: () => false,
          onJump: no,
          onOpen: no,
          onPopout: no
        }}
        onPopoutAll={no}
      />
    </div>
  )
}

export const agentsBusy = defineFixture({
  width: 528,
  render: () => <Tree mode="agents" botsOn />
})
export const agentsBusyNarrow = defineFixture({
  width: 400,
  render: () => <Tree mode="agents" botsOn />
})
export const agentsBotsOff = defineFixture({
  width: 528,
  render: () => <Tree mode="agents" botsOn={false} />
})
export const agentsIdleOpen = defineFixture({
  width: 528,
  render: () => <Tree mode="agents" botsOn idleOpen />
})
export const agentsSleeping = defineFixture({
  width: 528,
  render: () => <Tree mode="agents" botsOn sleeping />
})
export const agentsSearchHit = defineFixture({
  width: 528,
  render: () => <Tree mode="agents" botsOn query="scotty" />
})
export const allBusy = defineFixture({
  width: 528,
  render: () => <Tree mode="all" botsOn />
})
export const runningBusy = defineFixture({
  width: 528,
  render: () => <Running empty={false} botsOn={false} />
})
export const runningEmpty = defineFixture({
  width: 528,
  render: () => <Running empty botsOn={false} />
})
export const runningWithBots = defineFixture({
  width: 528,
  render: () => <Running empty={false} botsOn />
})
export const runningWithBotsNarrow = defineFixture({
  width: 400,
  render: () => <Running empty={false} botsOn />
})
export const agentsStateAsk = defineFixture({
  width: 528,
  render: () => <Tree mode="agents" botsOn stateFilter="ask" />
})
export const agentsStateIdle = defineFixture({
  width: 528,
  render: () => <Tree mode="agents" botsOn stateFilter="idle" />
})
export const agentsStateSleeping = defineFixture({
  width: 528,
  render: () => <Tree mode="agents" botsOn sleeping stateFilter="sleep" />
})

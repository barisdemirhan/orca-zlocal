import { defineFixture } from '../../component-fixtures/component-fixture'
import type { AgentChildRowModel } from '../../../../shared/agent-status/presentation/agent-child-row-model'
import type { GitStatusEntry } from '../../../../shared/git/status/git-status-types'
import type { MirrorChanges, MirrorReview, MirrorWork } from './agent-hub-mirror-card-facts'
import type { AgentHubMirrorDrawer } from './agent-hub-mirror-drawer-store'
import { AgentHubMirrorWorkStrip } from './AgentHubMirrorWorkStrip'
import { AgentHubMirrorWorkDrawer } from './AgentHubMirrorWorkDrawer'
import { AgentHubMirrorChangesDrawer } from './AgentHubMirrorChangesDrawer'
import { AgentHubMirrorReviewDrawer } from './AgentHubMirrorReviewDrawer'
import { AgentHubMirrorInboundDrawer } from './AgentHubMirrorInboundDrawer'
import { AgentHubMirrorSettingsDrawer } from './AgentHubMirrorSettingsDrawer'

const now = 1_000_000

function row(id: string, kind: 'agent' | 'command', name: string, age: number): AgentChildRowModel {
  return {
    id,
    kind,
    displayState: 'working',
    name,
    detail: null,
    firstObservedAt: now - age,
    recencyAt: now,
    canStop: false,
    settled: false,
    owned: []
  }
}

const work: MirrorWork = {
  subagents: [
    row('s1', 'agent', 'Inventory', 90_000),
    row('s2', 'agent', 'Translation keys', 30_000)
  ],
  commands: [row('c1', 'command', 'pnpm check:changed', 41_000)],
  workers: [],
  running: 3
}

function entry(path: string, added: number, removed: number): GitStatusEntry {
  return { path, status: 'modified', area: 'unstaged', added, removed }
}

const entries = [
  entry('src/AgentHubPanel.tsx', 121, 30),
  entry('src/agent-hub-inbox-groups.ts', 88, 0),
  entry('src/AgentHubAlertStack.tsx', 41, 19)
]
const changes: MirrorChanges = { entries, added: 250, removed: 49 }

const review: MirrorReview = {
  review: {
    provider: 'github',
    number: 412,
    title: 'Redesign the hub surfaces',
    state: 'open',
    url: 'https://github.com/example/repo/pull/412',
    status: 'failure',
    checksSummary: {
      state: 'failure',
      total: 13,
      passed: 12,
      failed: 1,
      pending: 0,
      neutral: 0
    },
    updatedAt: '2026-11-25T10:00:00Z',
    mergeable: 'MERGEABLE',
    headSha: 'abc123'
  },
  failedChecks: [{ name: 'test (2)', status: 'completed', conclusion: 'failure', url: null }]
}

function Frame({
  asleep = false,
  offline = false,
  drawer = null,
  isAgent = true,
  children
}: {
  asleep?: boolean
  offline?: boolean
  drawer?: AgentHubMirrorDrawer | null
  isAgent?: boolean
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex w-100 flex-col overflow-hidden rounded-xl border border-foreground/25 bg-background">
      <div className="h-24 p-3 font-mono text-xs text-muted-foreground">$ codex</div>
      <AgentHubMirrorWorkStrip
        work={work}
        queued={isAgent ? 1 : null}
        changes={changes}
        review={review}
        contextPercent={isAgent ? 42 : null}
        planProgress={null}
        isAgent={isAgent}
        shown={drawer}
        asleep={asleep}
        offline={offline}
        onToggle={() => {}}
      />
      {children ? (
        <div className="scrollbar-sleek h-56 overflow-y-auto border-t border-border bg-popover px-1.5 pb-2">
          {children}
        </div>
      ) : null}
    </div>
  )
}

export const working = defineFixture({ width: 420, render: () => <Frame /> })
export const asking = defineFixture({
  width: 420,
  render: () => <Frame drawer="inbound" />
})
export const sleeping = defineFixture({ width: 420, render: () => <Frame asleep /> })
export const offline = defineFixture({ width: 420, render: () => <Frame offline drawer="pr" /> })
export const terminalAgent = defineFixture({
  width: 420,
  render: () => (
    <Frame isAgent drawer="settings">
      <AgentHubMirrorSettingsDrawer tabId="fixture" isChat={false} disabled={false} />
    </Frame>
  )
})
export const workDrawer = defineFixture({
  width: 420,
  render: () => (
    <Frame drawer="work">
      <AgentHubMirrorWorkDrawer
        work={work}
        tabId="fixture"
        windowId="w"
        now={now}
        disabled={false}
      />
    </Frame>
  )
})
export const inboundDrawer = defineFixture({
  width: 420,
  render: () => (
    <Frame drawer="inbound">
      <AgentHubMirrorInboundDrawer tabId="none" isChat={false} disabled={false} />
    </Frame>
  )
})
export const changesDrawer = defineFixture({
  width: 420,
  render: () => (
    <Frame drawer="changes">
      <AgentHubMirrorChangesDrawer worktree={{ id: 'w', path: '/repo' }} changes={changes} />
    </Frame>
  )
})
export const prDrawer = defineFixture({
  width: 420,
  render: () => (
    <Frame drawer="pr">
      <AgentHubMirrorReviewDrawer
        card={{ worktreeId: 'w', worktreePath: '/repo', tabId: 't', repo: null }}
        review={review}
      />
    </Frame>
  )
})

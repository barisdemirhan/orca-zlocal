import { defineFixture } from '../../component-fixtures/component-fixture'
import { Button } from '@/components/ui/button'
import { AgentHubOrbChatStrip, type AgentHubOrbStripTab } from './AgentHubOrbChatStrip'
import { AgentHubOrbWindowTabs } from './AgentHubOrbWindowPanes'
import { AgentHubOrbBotFace } from './AgentHubOrbBotFace'
import { AgentHubOrbReadOnlyBarView } from './AgentHubOrbReadOnlyBar'
import { Lock } from 'lucide-react'

const no = (): void => {}

const tabs: AgentHubOrbStripTab[] = [
  { id: 'home', title: 'Home chat', status: 'working', live: false },
  { id: 'a', title: 'Sürüm planı', status: 'attention', live: false },
  { id: 'b', title: 'Sabah özeti', status: 'idle', live: false },
  { id: 'c', title: 'New chat', status: 'idle', live: false }
]

function Header({ state }: { state: string }): React.JSX.Element {
  return (
    <header className="flex items-center gap-2.5 px-3 py-2">
      <AgentHubOrbBotFace
        bot={null}
        size={30}
        sphere={{
          phase: state === 'Working' ? 'thinking' : 'idle',
          label: 'Orb',
          decorative: true
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">Orb</div>
        <div className="truncate text-xs text-muted-foreground">{state} · Codex</div>
      </div>
    </header>
  )
}

function Frame({
  state,
  tab = 'chat',
  needs = 1,
  strip,
  bottom
}: {
  state: string
  tab?: 'chat' | 'home' | 'chats'
  needs?: number
  strip?: React.ReactNode
  bottom?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <Header state={state} />
      <AgentHubOrbWindowTabs tab={tab} needs={needs} chatWaiting={tab !== 'chat'} onSelect={no} />
      {strip}
      <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
        Transcript
      </div>
      {bottom}
    </div>
  )
}

const strip = (props: Partial<React.ComponentProps<typeof AgentHubOrbChatStrip>> = {}) => (
  <AgentHubOrbChatStrip
    tabs={tabs}
    activeId="home"
    limit={8}
    full={false}
    onActivate={no}
    onClose={no}
    actions={{
      onNew: no,
      onRename: no,
      onClearHome: no,
      onOpenAsTab: no
    }}
    {...props}
  />
)

export const working = defineFixture({
  width: 528,
  render: () => <Frame state="Working" strip={strip()} />
})

export const asking = defineFixture({
  width: 528,
  render: () => <Frame state="Asking" strip={strip({ activeId: 'a' })} />
})

export const sleeping = defineFixture({
  width: 528,
  render: () => (
    <Frame
      state="Asleep"
      needs={0}
      strip={strip({
        tabs: tabs.map((entry) => ({ ...entry, status: 'idle' as const })),
        actions: undefined
      })}
    />
  )
})

export const liveOnHome = defineFixture({
  width: 528,
  render: () => (
    <Frame
      state="Working"
      strip={
        <>
          {strip({
            activeId: 'b',
            tabs: tabs.map((entry) => ({ ...entry, live: entry.id === 'home' }))
          })}
          <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs">
            <span className="flex-1 text-muted-foreground">Live is on Home chat</span>
            <Button size="xs" variant="outline" onClick={no}>
              Back to Live
            </Button>
            <Button size="xs" variant="outline" onClick={no}>
              Move Live here
            </Button>
          </div>
        </>
      }
    />
  )
})

export const full = defineFixture({
  width: 528,
  render: () => (
    <Frame
      state="Working"
      strip={strip({
        limit: 4,
        full: true,
        tabs: tabs.map((entry) => ({ ...entry, status: 'working' as const }))
      })}
    />
  )
})

export const homeTab = defineFixture({
  width: 528,
  render: () => <Frame state="Idle" tab="home" />
})

const workerTabs: AgentHubOrbStripTab[] = [
  ...tabs,
  { id: 'w', title: 'Release check', status: 'idle', live: false, readOnly: true, agent: 'claude' }
]

export const workerTab = defineFixture({
  width: 528,
  render: () => (
    <Frame
      state="Idle"
      strip={
        <>
          {strip({ tabs: workerTabs, activeId: 'w' })}
          <div className="flex items-center gap-1.5 border-b border-border px-3 py-1 text-2xs text-muted-foreground">
            <Lock className="size-3" aria-hidden />
            Worker transcript, read only
          </div>
        </>
      }
      bottom={<AgentHubOrbReadOnlyBarView kind="worker" onAction={no} />}
    />
  )
})

export const asleepWindow = defineFixture({
  width: 528,
  render: () => (
    <Frame
      state="Asleep"
      needs={0}
      strip={strip({
        tabs: tabs.map((entry) => ({ ...entry, status: 'idle' as const })),
        actions: undefined
      })}
      bottom={<AgentHubOrbReadOnlyBarView kind="asleep" onAction={no} />}
    />
  )
})

export const openInMainTab = defineFixture({
  width: 528,
  render: () => (
    <Frame
      state="Idle"
      strip={
        <>
          {strip({ activeId: 'a' })}
          <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs">
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              &quot;Sürüm planı&quot; is open in a main tab.
            </span>
            <Button size="xs" variant="outline" onClick={no}>
              Bring here
            </Button>
          </div>
        </>
      }
    />
  )
})

export const narrow = defineFixture({
  width: 368,
  render: () => (
    <Frame
      state="Idle"
      strip={strip({ tabs: workerTabs, activeId: 'w' })}
      bottom={<AgentHubOrbReadOnlyBarView kind="worker" onAction={no} />}
    />
  )
})

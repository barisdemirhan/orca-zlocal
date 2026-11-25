import { defineFixture } from '../../component-fixtures/component-fixture'
import { setBotHostListing } from '@/lib/bot-catalog-snapshot'
import { AgentHubInboxList } from './AgentHubInboxList'
import { AgentHubInboxSubHeader } from './AgentHubInboxSubHeader'
import type { AgentHubInboxEntryContext } from './AgentHubInboxEntryView'
import type {
  AgentHubInboxItem,
  AgentHubInboxItemGroup,
  AgentHubInboxModel
} from './agent-hub-inbox-model'
import type { AgentHubInboxView } from './use-agent-hub-inbox-view'

const no = (): void => {}
const NOW = Date.now()
const MIN = 60_000

const CB = 'runtime:cb'

function bot(name: string, hostId = 'local'): never {
  return { id: name, name, hostId, folder: '/tmp', agent: 'claude' } as never
}

function botAsk(
  name: string,
  id: string,
  gist: string,
  minutesAgo: number,
  extra: { hostId?: string; decisions?: number; origin?: string } = {}
): AgentHubInboxItem {
  return {
    id,
    senderKey: name,
    side: 'bots',
    kind: 'ask',
    since: NOW - minutesAgo * MIN,
    origin: extra.origin ?? 'home',
    payload: {
      type: 'bot-item',
      bot: bot(name, extra.hostId),
      item: {
        uid: id,
        number: 7,
        title: gist,
        chat: { id, kind: 'home' },
        question: {
          eventId: id,
          text: gist,
          gist,
          decisions: Array.from({ length: extra.decisions ?? 0 }, () => ({}))
        }
      } as never,
      askId: id,
      remaining: null
    }
  }
}

function thread(id: string, agent: string, text: string): never {
  return {
    paneKey: id,
    paneTitle: text,
    responsePreview: '',
    agentType: agent,
    repo: { displayName: 'orca' },
    worktree: { hostId: 'local', displayName: 'agent-hub', path: '/tmp/agent-hub' },
    state: 'waiting',
    paneEntry: { state: 'waiting', lastAssistantMessage: text, prompt: text }
  } as never
}

function agentAsk(
  id: string,
  agent: string,
  text: string,
  minutesAgo: number,
  extra: Partial<AgentHubInboxItem> = {}
): AgentHubInboxItem {
  return {
    id,
    senderKey: extra.senderKey ?? agent,
    side: extra.side ?? 'agents',
    kind: 'ask',
    since: NOW - minutesAgo * MIN,
    payload: { type: 'thread', thread: thread(id, agent, text) },
    ...extra
  }
}

function finished(
  id: string,
  agent: string,
  kind: 'fail' | 'result',
  text: string,
  minutesAgo: number
): AgentHubInboxItem {
  return {
    id,
    senderKey: agent,
    side: 'agents',
    kind,
    since: NOW - minutesAgo * MIN,
    payload: { type: 'finished', thread: thread(id, agent, text) }
  }
}

const group = (
  key: string,
  side: 'bots' | 'agents',
  parts: Partial<Omit<AgentHubInboxItemGroup, 'key' | 'side'>>
): AgentHubInboxItemGroup => ({
  key,
  side,
  asks: [],
  fails: [],
  results: [],
  suggestions: [],
  ...parts
})

const suggestion = (name: string, id: string, title: string): AgentHubInboxItem => ({
  id,
  senderKey: name,
  side: 'bots',
  kind: 'suggestion',
  since: null,
  payload: { type: 'suggestion', bot: bot(name), suggestion: { title } as never }
})

const BUSY: AgentHubInboxItemGroup[][] = [
  [
    group('Ada', 'bots', {
      asks: [
        botAsk('Ada', 'a1', 'Which environment should the migration run on first?', 42, {
          decisions: 3
        }),
        botAsk('Ada', 'a2', 'Rotate the leaked token now?', 18)
      ],
      suggestions: [
        suggestion('Ada', 's1', 'Archive stale branches'),
        suggestion('Ada', 's2', 'Clean the logs')
      ]
    }),
    group('Mira', 'bots', {
      asks: [
        {
          ...agentAsk('w1', 'codex', 'Delete the staging bucket?', 9, {
            senderKey: 'Mira',
            side: 'bots'
          }),
          origin: 'worker',
          bot: bot('Mira')
        }
      ]
    }),
    group('Kai', 'bots', {
      asks: [botAsk('Kai', 'k1', 'Notify the customer?', 6, { hostId: CB })]
    })
  ],
  [
    group('claude', 'agents', {
      asks: [agentAsk('c1', 'claude', 'Run the migration against production?', 30)],
      fails: [finished('f1', 'claude', 'fail', 'The build failed: 3 type errors in billing.', 6)]
    }),
    group('codex', 'agents', {
      asks: [
        agentAsk('x1', 'codex', 'Apply the rename across the repo?', 12, { workerOf: '@claude' })
      ],
      results: [
        finished('d1', 'codex', 'result', 'Updated the settings pane. Added two tests.', 12),
        finished('d2', 'codex', 'result', 'Renamed the store files.', 30)
      ]
    })
  ]
]

function modelOf(boxes: AgentHubInboxItemGroup[][], hidden = 0): AgentHubInboxModel {
  return {
    botsActive: true,
    hidden,
    hiddenEntries: [],
    counts: {
      inbox: 6,
      botAsks: 4,
      agentAsks: 2,
      dock: { needsYou: 6, working: 3, finished: 3, nestedWorking: 0 }
    },
    boxes: [
      { side: 'bots', groups: boxes[0] },
      { side: 'agents', groups: boxes[1] }
    ]
  } as AgentHubInboxModel
}

function viewOf(model: AgentHubInboxModel, selectedKey: string | null): AgentHubInboxView {
  return {
    boxes: model.boxes,
    selectedKey,
    isOpen: () => true,
    activeAskId: () => null,
    activateAsk: no,
    select: no,
    toggle: no,
    ghosts: [],
    onKey: () => false,
    onPanelKey: () => false,
    controlRef: { current: null },
    selectedThread: null
  }
}

const context: AgentHubInboxEntryContext = {
  now: NOW,
  popoutKeys: ['⌥↵'],
  actions: {
    locationOf: () => ({ project: 'orca', workspace: 'agent-hub', host: null }) as never
  } as never,
  presentationOf: (() => ({})) as never,
  onMarkRead: no,
  onLater: no,
  onOpenEntry: no,
  onOpenBotPage: no,
  onOpenBotSettings: no
}

function render(boxes: AgentHubInboxItemGroup[][], selected: string | null) {
  const model = modelOf(boxes)
  return (
    <div className="bg-popover p-2.5">
      <AgentHubInboxSubHeader botsActive waiting={6} finishedKeys={['d1']} onMarkRead={no} />
      <AgentHubInboxList
        model={model}
        view={viewOf(model, selected)}
        context={context}
        workingCount={3}
      />
    </div>
  )
}

const store = {
  runtimeEnvironments: [{ id: 'cb', name: 'cb' }]
} as never

const setup = (): void => {
  setBotHostListing({
    hosts: [
      { hostId: 'local', state: 'live' },
      { hostId: CB, state: 'offline' }
    ],
    updateNeeded: []
  })
}

export const busy = defineFixture({
  width: 560,
  store,
  setup,
  render: () => render(BUSY, 'Mira')
})
export const busyNarrow = defineFixture({
  width: 400,
  store,
  setup,
  render: () => render(BUSY, 'Ada')
})
export const empty = defineFixture({
  width: 560,
  store,
  setup,
  render: () => render([[], []], null)
})

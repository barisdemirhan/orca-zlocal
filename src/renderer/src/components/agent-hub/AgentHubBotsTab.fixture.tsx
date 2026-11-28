import { defineFixture } from '../../component-fixtures/component-fixture'
import { stubBots } from '../../component-fixtures/fixture-bots'
import { fixtureAutomation, fixtureChat } from '../../component-fixtures/fixture-bot-panel'
import { publishBots, setBotHostListing } from '@/lib/bot-catalog-snapshot'
import { getDefaultSettings } from '../../../../shared/orca-profiles/constants'
import { botRefKey } from '@/lib/bot-hosts'
import { useAppStore } from '@/store'
import { makeFolderWorkspace } from '@/store/folder-workspaces/folder-workspace.test-fixture'
import { mascotAvatar, type BotMascotId } from '../../../../shared/bot-avatar'
import type { Bot } from '../../../../shared/bot-types'
import type { BotChatTreeChat, BotChatTreeWorker } from '../../../../shared/bots/bot-chat-tree'
import type { BotAutomationRow } from '../../../../shared/bots/bot-automation-rows'
import type { ExecutionHostId } from '../../../../shared/execution-host/execution-host'
import { createCompatibleRuntimeStatusResponse } from '@/runtime/rpc/testing/runtime-compatibility-test-fixture'
import type { PublicKnownRuntimeEnvironment } from '../../../../shared/remote-runtime/host-catalog/runtime-environments'
import { ConfirmationDialogProvider } from '../dismiss/confirmation/confirmation-dialog'
import { AgentHubBotsTab } from './AgentHubBotsTab'
import { updateAgentHubPanelListState } from './agent-hub-panel-list-state'

const CB: ExecutionHostId = 'runtime:cb'
const onCb = (owner: Bot): boolean => owner.id === 'cb-ops'
const MIN = 60_000
const now = Date.now()

function bot(id: string, name: string, mascot: BotMascotId, fields: Partial<Bot> = {}): Bot {
  return {
    id,
    name,
    hostId: 'local',
    folder: id,
    folderWorkspaceId: `fw-${id}`,
    agent: 'claude',
    avatar: mascotAvatar(mascot),
    paused: false,
    notifications: { needsPermission: true, taskComplete: true, couldNotFinish: true },
    members: [],
    slack: null,
    linear: null,
    github: null,
    chatSessionId: `chat-${id}`,
    createdAt: 1,
    updatedAt: 1,
    ...fields
  }
}

const cos = bot('cos', 'CoS', 'G1')
const release = bot('release', 'Release bot', 'B1')
const triage = bot('triage', 'Issue triage bot', 'D1', { paused: true })
const nightly = bot('nightly', 'Nightly', 'E1')

const worker = (id: string, title: string): BotChatTreeWorker => ({
  key: id,
  title,
  state: 'running',
  startedAt: now - 4 * MIN
})

const failedWorker = (id: string, title: string): BotChatTreeWorker => ({
  key: id,
  title,
  state: 'failed',
  startedAt: now - 3 * 60 * MIN,
  settledAt: now - 2 * 60 * MIN
})

type Tree = { chats: BotChatTreeChat[]; automations: BotAutomationRow[] }

const TREES: Record<string, Tree> = {
  cos: {
    chats: [
      fixtureChat('c1', 'Which invoice export format?', {
        live: 'needs-you',
        preview: 'CSV or XLSX for the invoice export?',
        unread: true,
        lastActiveAt: now - 2 * MIN
      }),
      fixtureChat('c2', 'Plan the billing migration', {
        live: 'replying',
        lastActiveAt: now - 20_000,
        running: [worker('w1', 'Draft the migration'), worker('w2', 'Check the schema')]
      }),
      fixtureChat('c3', 'Rename the store files', { lastActiveAt: now - 50 * MIN }),
      fixtureChat('c4', 'Draft the changelog', { lastActiveAt: now - 3 * 60 * MIN }),
      fixtureChat('c5', 'Slack: can you check the nightly?', {
        origin: 'slack',
        lastActiveAt: now - 5 * 60 * MIN
      }),
      fixtureChat('c6', 'Tidy the docs', { lastActiveAt: now - 8 * 60 * MIN }),
      fixtureChat('c7', 'Old release plan', { closed: true, lastActiveAt: now - 30 * 60 * MIN }),
      fixtureChat('c8', 'Old standup notes', { closed: true, lastActiveAt: now - 40 * 60 * MIN })
    ],
    automations: [
      fixtureAutomation('a1', 'Morning briefing', 'FREQ=DAILY'),
      { ...fixtureAutomation('a2', 'Weekly digest', 'FREQ=WEEKLY'), failing: true }
    ]
  },
  release: {
    chats: [fixtureChat('r1', 'Cut v1.4.231', { lastActiveAt: now - 2 * MIN })],
    automations: []
  },
  triage: {
    chats: [fixtureChat('t1', 'Label new issues', { lastActiveAt: now - 90 * MIN })],
    automations: []
  },
  nightly: { chats: [], automations: [] },
  'cb-ops': {
    chats: [
      fixtureChat('o1', 'Rotate the staging keys', { lastActiveAt: now - 30 * MIN }),
      fixtureChat('o2', 'Nightly backup check', {
        lastActiveAt: now - 3 * 60 * MIN,
        finished: [failedWorker('f1', 'Verify the snapshot')]
      })
    ],
    automations: [{ ...fixtureAutomation('o-a1', 'Disk watch', 'FREQ=HOURLY'), failing: true }]
  }
}

function answerRead(method: string, params: unknown): unknown {
  const id = typeof params === 'object' && params && 'botId' in params ? params.botId : null
  const tree = typeof id === 'string' ? TREES[id] : undefined
  if (method === 'bots.chatTree') {
    return { ok: true, result: { chats: tree?.chats ?? [], workspaceChats: {} } }
  }
  if (method === 'bots.activity') {
    const activity = {
      workers: [],
      inProgress: [],
      completed: [],
      automations: tree?.automations ?? [],
      waits: []
    }
    return { ok: true, result: { activity } }
  }
  return null
}

function stubReads(): void {
  const runtime = window.api.runtime
  const fallback = runtime.call
  Reflect.set(window.api, 'runtime', {
    ...runtime,
    call: async (request: Parameters<typeof fallback>[0]) =>
      answerRead(request.method, request.params) ?? fallback(request)
  })
  const environments = window.api.runtimeEnvironments
  const remoteFallback = environments.call
  Reflect.set(window.api, 'runtimeEnvironments', {
    ...environments,
    call: async (request: Parameters<typeof remoteFallback>[0]) =>
      request.method === 'status.get'
        ? { ok: true, result: createCompatibleRuntimeStatusResponse('cb').result }
        : (answerRead(request.method, request.params) ?? remoteFallback(request))
  })
}

type Scene = { bots: Bot[]; expanded?: string[]; offline?: boolean; query?: string; width?: number }

function scene({ bots, expanded = ['cos'], offline = false, query = '', width = 480 }: Scene) {
  return defineFixture({
    width: width + 24,
    store: {
      runtimeEnvironments: [environment()],
      runtimeStatusByEnvironmentId: new Map([
        ['cb', { status: createCompatibleRuntimeStatusResponse('cb').result, checkedAt: 1 }]
      ]),
      folderWorkspaces: bots.map((owner) =>
        makeFolderWorkspace({
          id: owner.folderWorkspaceId,
          name: owner.name,
          folderPath: `/bots/${owner.folder}`,
          executionHostId: onCb(owner) ? CB : 'local',
          isUnread: owner.id === 'release'
        })
      )
    },
    setup: () => {
      useAppStore.setState({
        settings: { ...getDefaultSettings('/home/u'), experimentalAgentHub: true }
      })
      updateAgentHubPanelListState({
        botsQuery: query,
        botsExpanded: new Set(
          expanded.map((id) => botRefKey({ id, hostId: id === 'cb-ops' ? CB : 'local' }))
        )
      })
      setBotHostListing({
        hosts: [
          { hostId: 'local', state: 'live' },
          ...(bots.some((owner) => onCb(owner)) || offline
            ? [{ hostId: CB, state: offline ? 'offline' : 'live' } as const]
            : [])
        ],
        updateNeeded: []
      })
      stubBots(bots.filter((owner) => !onCb(owner)))
      const remote = bots.filter((owner) => onCb(owner))
      if (remote.length > 0) {
        publishBots(remote, { threadReplies: false, webhooks: undefined }, CB)
      }
      stubReads()
    },
    render: () => (
      <ConfirmationDialogProvider>
        <div className="bg-background p-3">
          <div
            className="flex flex-col overflow-hidden rounded-lg border border-border bg-background"
            style={{ width }}
          >
            <AgentHubBotsTab onClose={() => {}} />
          </div>
        </div>
      </ConfirmationDialogProvider>
    )
  })
}

function environment(): PublicKnownRuntimeEnvironment {
  return {
    id: 'cb',
    name: 'cb',
    createdAt: 1,
    updatedAt: 1,
    lastUsedAt: null,
    runtimeId: null,
    endpoints: [],
    preferredEndpointId: 'cb'
  }
}

const cbBot = bot('cb-ops', 'Ops bot', 'F1')

export const busy = scene({
  bots: [cos, release, triage, nightly],
  expanded: ['cos', 'release', 'triage']
})
export const narrow = scene({ bots: [cos, release, triage, nightly], width: 400 })
export const offlineAsleep = scene({
  bots: [cos, nightly, cbBot],
  expanded: ['cos', 'cb-ops'],
  offline: true
})
export const empty = scene({ bots: [] })
export const search = scene({ bots: [cos, release, triage, nightly], query: 'invoice' })

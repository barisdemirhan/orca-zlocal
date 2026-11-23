import {
  ORB_ACCESS_RANK,
  agentHubOrbPermissionMode,
  agentHubOrbPermissionOptions
} from './agent-hub-orb-permission-settings'
import { resumeAgentHubOrbSession } from './agent-hub-orb-session-resume'
import type { AgentChatPermissionMode } from '../../../shared/agent-launch/permissions/agent-chat-permission-mode'
import {
  AGENT_HUB_ORB_ORIGIN,
  type AgentHubOrbConversation,
  type AgentHubOrbOpenParams,
  type AgentHubOrbSession
} from '../../../shared/agent-hub-orb'
import {
  normalizeAgentHubOrbSettings,
  agentHubOrbSupportsAsk,
  AGENT_HUB_ORB_PI_PERMISSION_REASON
} from '../../../shared/agent-hub-orb-settings'
import type { AgentHubSettings } from '../../../shared/agent-hub-settings'
import { isStructuredAgentId } from '../../../shared/agent-session/lifecycle/provider-handles/agent-session-provider-handle-encoding'
import type { AgentSessionRecord } from '../../../shared/agent-session/lifecycle/agent-session-record'
import { getStructuredAgentSessionHost } from '../../native-chat/agent-session-wire/host/structured-agent-session-registry'
import type { StructuredAgentSessionHost } from '../../native-chat/agent-session-wire/host/structured-agent-session-host'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { AgentHubError } from '../../runtime/agent-hub/agent-hub-error'
import { closeAgentHubOrbSession } from './agent-hub-orb-session-close'
import {
  listAgentHubOrbBotConversations,
  agentHubOrbBotSession,
  closeAgentHubOrbBotChat,
  openAgentHubOrbBotSession,
  type AgentHubOrbBotChats
} from './agent-hub-orb-bot-session'
import {
  agentHubOrbIdentityOptions,
  ensureAgentHubOrbDirectory,
  requireAgentHubOrbCwd
} from './agent-hub-orb-directory'
import { listAgentHubOrbConversations } from './agent-hub-orb-history'
import {
  prepareAgentHubOrbSessionCreate,
  commitAgentHubOrbSessionCreate,
  ensureAgentHubOrbOpeningPrompt
} from './agent-hub-orb-session-create'
import {
  agentHubOrbSettingsNeedTransition,
  replaceAgentHubOrbSession,
  requireIdleAgentHubOrbSession
} from './agent-hub-orb-settings-transition'

const caller = { callerKey: 'trusted-local:agent-hub-orb' }
export type OrbRuntime = Pick<
  OrcaRuntimeService,
  | 'isAgentHubEnabled'
  | 'ensureStructuredAgentSessionHost'
  | 'resolveStructuredAgentSessionCreateIntent'
  | 'getAgentProviderSessionRows'
  | 'resolveStructuredAgentSessionLocalWorkspacePath'
  | 'getStructuredAgentCliSourceRoute'
  | 'publishStructuredAgentSessionTab'
  | 'closeMobileSessionTab'
> & { agentHub: Pick<OrcaRuntimeService['agentHub'], 'snapshot'> }

export class AgentHubOrbSessionManager {
  private opening: Promise<AgentHubOrbSession> | null = null
  private openingKey: string | undefined
  private operations: Promise<void> = Promise.resolve()
  private active: AgentHubOrbSession | null = null
  private appliedMode: AgentChatPermissionMode | null = null
  private selectedSettings: ReturnType<typeof normalizeAgentHubOrbSettings> | null = null

  constructor(
    private readonly runtime: OrbRuntime,
    private readonly getSettings: () => AgentHubSettings,
    private readonly saveCwd: (cwd: string) => void | Promise<void>,
    /** The Orb folder, created and its instruction files refreshed on every open. */
    private readonly resolveDirectory: () => Promise<string> = () =>
      ensureAgentHubOrbDirectory(undefined, agentHubOrbIdentityOptions(getSettings())),
    /** With it the Orb is the Orb bot's Home chat; without it, a floating chat of its own. */
    private readonly botChats?: AgentHubOrbBotChats
  ) {}

  requireEnabled(): void {
    if (!this.runtime.isAgentHubEnabled()) {
      throw new AgentHubError('disabled', 'Agent Hub Orb is disabled')
    }
  }

  current(): AgentHubOrbSession | null {
    this.requireEnabled()
    return this.currentSession()
  }

  private currentSession(): AgentHubOrbSession | null {
    const host = getStructuredAgentSessionHost()
    const bot = this.botChats?.find()
    const session = bot ? agentHubOrbBotSession(host, bot) : this.floatingSession(host)
    if (!session) {
      this.active = null
    }
    return session
  }

  /** The Orb's own floating chat, from before the Orb bot or without one. */
  private floatingSession(
    host: StructuredAgentSessionHost | null | undefined
  ): AgentHubOrbSession | null {
    const record =
      host && this.orbRecords(host).find((entry) => host.getSessionTabId(entry.sessionId))
    if (!record || !host) {
      return null
    }
    const tabId = host.getSessionTabId(record.sessionId)
    return this.active?.sessionId === record.sessionId
      ? this.active
      : { sessionId: record.sessionId, ...(tabId ? { tabId } : {}), resumed: false }
  }

  open(params: AgentHubOrbOpenParams = {}): Promise<AgentHubOrbSession> {
    this.requireEnabled()
    const settings = normalizeAgentHubOrbSettings(this.getSettings())
    const key = JSON.stringify([settings.agent, settings.model, settings.permission, params])
    if (this.opening && this.openingKey === key) {
      return this.opening
    }
    const opening = this.enqueue(() => this.openOnce(params)).finally(() => {
      if (this.opening === opening) {
        this.opening = null
        this.openingKey = undefined
      }
    })
    this.opening = opening
    this.openingKey = key
    return opening
  }

  close(): Promise<void> {
    this.opening = null
    this.openingKey = undefined
    return this.enqueue(() => this.closeOnce())
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.operations.then(operation)
    this.operations = next.then(
      () => {},
      () => {}
    )
    return next
  }

  private async closeOnce(): Promise<void> {
    const host = getStructuredAgentSessionHost()
    if (!host) {
      return
    }
    const current = this.currentSession()
    if (!current) {
      return
    }
    await (this.botChats?.find()
      ? closeAgentHubOrbBotChat(this.runtime, this.botChats, current.sessionId)
      : closeAgentHubOrbSession(this.runtime, host, current))
    this.active = null
    this.appliedMode = null
  }

  /** Access rank of the mode the open chat was created with; null when unknown. */
  appliedAccessRank(): number | null {
    return this.appliedMode ? ORB_ACCESS_RANK[this.appliedMode] : null
  }

  async list(limit = 30): Promise<AgentHubOrbConversation[]> {
    this.requireEnabled()
    const host = await this.ensureHost()
    const bot = this.botChats?.find()
    return bot
      ? listAgentHubOrbBotConversations(host, bot, this.orbRecords(host), limit)
      : listAgentHubOrbConversations(host, this.orbRecords(host), limit)
  }

  private async openOnce(params: AgentHubOrbOpenParams): Promise<AgentHubOrbSession> {
    if (this.botChats) {
      return this.openBot(this.botChats, params)
    }
    const settings = normalizeAgentHubOrbSettings(this.getSettings())
    // Older clients may supply a cwd; ordinary opens run in the Orb folder.
    const cwd = params.cwd === undefined ? undefined : await requireAgentHubOrbCwd(params.cwd)
    if (cwd) {
      await this.saveCwd(cwd)
    }
    const host = await this.ensureHost()
    this.requireEnabled()
    const orbDirectory = await this.resolveDirectory()
    const current = this.current()
    const record = current ? host.deps.store.getRecord(current.sessionId) : null
    const changeSettings =
      !params.resume && agentHubOrbSettingsNeedTransition(this.selectedSettings, settings, record)
    if (
      current &&
      !changeSettings &&
      (!params.resume || current.sessionId === params.resume.sessionId)
    ) {
      if (record && settings.permission === 'ask' && !agentHubOrbSupportsAsk(record.provider)) {
        throw new AgentHubError('invalid_argument', AGENT_HUB_ORB_PI_PERMISSION_REASON)
      }
      return this.finishOpen(host, current, settings, orbDirectory)
    }
    const previous = params.resume ? host.deps.store.getRecord(params.resume.sessionId) : null
    if (params.resume && previous?.origin !== AGENT_HUB_ORB_ORIGIN) {
      throw new AgentHubError('not_found', 'Orb conversation was not found on this host')
    }
    const agent = previous?.provider ?? params.agent ?? settings.agent
    if (settings.permission === 'ask' && !agentHubOrbSupportsAsk(agent)) {
      throw new AgentHubError('invalid_argument', AGENT_HUB_ORB_PI_PERMISSION_REASON)
    }
    if (!isStructuredAgentId(agent) || (previous && params.agent && params.agent !== agent)) {
      throw new AgentHubError('invalid_argument', 'Orb resume must use the conversation agent')
    }
    if (current && changeSettings) {
      await requireIdleAgentHubOrbSession(host, this.runtime.agentHub, current.sessionId)
    }
    if (previous) {
      this.appliedMode = null
      const resumed = await resumeAgentHubOrbSession({
        runtime: this.runtime,
        host,
        current,
        previous,
        mode: agentHubOrbPermissionMode(this.getSettings(), agent)
      })
      this.appliedMode = resumed.mode
      return this.finishOpen(host, resumed.session, settings, orbDirectory)
    }
    const model = params.model === undefined ? settings.model : params.model
    const { prepared } = await prepareAgentHubOrbSessionCreate({
      runtime: this.runtime,
      host,
      caller,
      agent,
      model,
      cwd: cwd ?? orbDirectory,
      permissionOptions: agentHubOrbPermissionOptions(this.getSettings(), agent)
    })
    this.requireEnabled()
    const appliedMode = agentHubOrbPermissionMode(this.getSettings(), agent)
    const created = await replaceAgentHubOrbSession(
      this.runtime,
      host,
      current,
      prepared.attachParams.envelope.sessionId,
      () => commitAgentHubOrbSessionCreate({ runtime: this.runtime, caller, prepared })
    )
    this.appliedMode = appliedMode
    return this.finishOpen(host, created, settings, orbDirectory)
  }

  private async openBot(
    chats: AgentHubOrbBotChats,
    params: AgentHubOrbOpenParams
  ): Promise<AgentHubOrbSession> {
    const host = await this.ensureHost()
    this.requireEnabled()
    const settings = normalizeAgentHubOrbSettings(this.getSettings())
    const { session, mode } = await openAgentHubOrbBotSession({
      host,
      hub: this.runtime.agentHub,
      chats,
      rawSettings: this.getSettings(),
      settings,
      previous: this.selectedSettings,
      resumeSessionId: params.resume?.sessionId
    })
    this.appliedMode = mode
    this.active = session
    this.selectedSettings = settings
    const floating = this.floatingSession(host)
    if (floating) {
      // The floating chat from before the Orb bot would otherwise keep running beside it.
      await closeAgentHubOrbSession(this.runtime, host, floating).catch((error: unknown) => {
        console.warn('Could not close the Orb chat from before the Orb bot', error)
      })
    }
    if (!this.runtime.isAgentHubEnabled()) {
      await this.closeOnce()
      throw new AgentHubError('disabled', 'Agent Hub Orb is disabled')
    }
    return session
  }

  private async finishOpen(
    host: StructuredAgentSessionHost,
    session: AgentHubOrbSession,
    settings: ReturnType<typeof normalizeAgentHubOrbSettings>,
    orbDirectory: string
  ): Promise<AgentHubOrbSession> {
    this.active = session
    this.selectedSettings = settings
    if (!this.runtime.isAgentHubEnabled()) {
      await this.closeOnce()
      throw new AgentHubError('disabled', 'Agent Hub Orb is disabled')
    }
    await ensureAgentHubOrbOpeningPrompt(host, caller, session.sessionId, orbDirectory)
    return session
  }

  private async ensureHost(): Promise<StructuredAgentSessionHost> {
    await this.runtime.ensureStructuredAgentSessionHost()
    const host = getStructuredAgentSessionHost()
    if (!host) {
      throw new AgentHubError('disabled', 'Structured agent sessions are unavailable on this host')
    }
    return host
  }

  private orbRecords(host: StructuredAgentSessionHost): AgentSessionRecord[] {
    return host.deps.store
      .listRecords()
      .filter((record) => record.origin === AGENT_HUB_ORB_ORIGIN)
      .sort((left, right) => right.createdAt - left.createdAt)
  }
}

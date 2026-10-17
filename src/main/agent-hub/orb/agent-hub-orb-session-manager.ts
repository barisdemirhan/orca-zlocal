import { agentHubOrbPermissionOptions } from './agent-hub-orb-permission-settings'
import { stat } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
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
import { isStructuredAgentId } from '../../../shared/agent-session-provider-handle'
import type { AgentSessionRecord } from '../../../shared/agent-session-record'
import { getStructuredAgentSessionHost } from '../../native-chat/agent-session-wire/structured-agent-session-registry'
import type { StructuredAgentSessionHost } from '../../native-chat/agent-session-wire/structured-agent-session-host'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import type { RuntimeStore } from '../../runtime/runtime-store-contract'
import { AgentHubError } from '../../runtime/agent-hub/agent-hub-error'
import { closeAgentHubOrbSession } from './agent-hub-orb-session-close'
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
type OrbRuntime = Pick<
  OrcaRuntimeService,
  | 'isAgentHubEnabled'
  | 'ensureStructuredAgentSessionHost'
  | 'resolveStructuredAgentSessionCreateIntent'
  | 'getAgentProviderSessionRows'
  | 'publishStructuredAgentSessionTab'
  | 'closeMobileSessionTab'
> & { agentHub: Pick<OrcaRuntimeService['agentHub'], 'snapshot'> }

export class AgentHubOrbSessionManager {
  private opening: Promise<AgentHubOrbSession> | null = null
  private openingKey: string | undefined
  private operations: Promise<void> = Promise.resolve()
  private active: AgentHubOrbSession | null = null
  private selectedSettings: ReturnType<typeof normalizeAgentHubOrbSettings> | null = null

  constructor(
    private readonly runtime: OrbRuntime,
    private readonly getSettings: () => AgentHubSettings,
    private readonly saveCwd: (cwd: string) => void | Promise<void>
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
    const record =
      host && this.orbRecords(host).find((entry) => host.getSessionTabId(entry.sessionId))
    if (!record || !host) {
      this.active = null
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
    await closeAgentHubOrbSession(this.runtime, host, current)
    this.active = null
  }

  async list(limit = 30): Promise<AgentHubOrbConversation[]> {
    this.requireEnabled()
    const host = await this.ensureHost()
    return listAgentHubOrbConversations(host, this.orbRecords(host), limit)
  }

  private async openOnce(params: AgentHubOrbOpenParams): Promise<AgentHubOrbSession> {
    const settings = normalizeAgentHubOrbSettings(this.getSettings())
    const cwd = params.cwd?.trim()
    // Older clients may supply a cwd; ordinary opens use the host's floating workspace resolver.
    if (params.cwd !== undefined) {
      if (!cwd || !isAbsolute(cwd)) {
        throw new AgentHubError('invalid_argument', 'Orb folder must be an absolute path')
      }
      const directory = await stat(cwd).catch(() => null)
      if (!directory?.isDirectory()) {
        throw new AgentHubError(
          'invalid_argument',
          'Orb folder does not exist or is not a directory'
        )
      }
      await this.saveCwd(cwd)
    }
    const host = await this.ensureHost()
    this.requireEnabled()
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
      return this.finishOpen(host, current, settings)
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
      const resumed = await replaceAgentHubOrbSession(
        this.runtime,
        host,
        current,
        previous.sessionId,
        async () => {
          const revealed = await host.revealSession(previous.sessionId)
          await this.runtime.publishStructuredAgentSessionTab({
            workspaceId: revealed.workspaceId,
            sessionId: revealed.sessionId,
            agent: revealed.agent,
            activate: false
          })
          const tabId = host.getSessionTabId(previous.sessionId)
          return { sessionId: previous.sessionId, ...(tabId ? { tabId } : {}), resumed: true }
        }
      )
      return this.finishOpen(host, resumed, settings)
    }
    const model = params.model === undefined ? settings.model : params.model
    const { prepared } = await prepareAgentHubOrbSessionCreate({
      runtime: this.runtime,
      host,
      caller,
      agent,
      model,
      cwd,
      permissionOptions: agentHubOrbPermissionOptions(this.getSettings(), agent)
    })
    this.requireEnabled()
    const created = await replaceAgentHubOrbSession(
      this.runtime,
      host,
      current,
      prepared.attachParams.envelope.sessionId,
      () => commitAgentHubOrbSessionCreate({ runtime: this.runtime, caller, prepared })
    )
    return this.finishOpen(host, created, settings)
  }

  private async finishOpen(
    host: StructuredAgentSessionHost,
    session: AgentHubOrbSession,
    settings: ReturnType<typeof normalizeAgentHubOrbSettings>
  ): Promise<AgentHubOrbSession> {
    this.active = session
    this.selectedSettings = settings
    if (!this.runtime.isAgentHubEnabled()) {
      await this.closeOnce()
      throw new AgentHubError('disabled', 'Agent Hub Orb is disabled')
    }
    await ensureAgentHubOrbOpeningPrompt(host, caller, session.sessionId)
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

export function createAgentHubOrbSessionManager(
  runtime: OrbRuntime,
  store: Pick<RuntimeStore, 'getSettings' | 'updateSettings' | 'onSettingsChanged'> | null
): AgentHubOrbSessionManager {
  const manager = new AgentHubOrbSessionManager(
    runtime,
    () => store?.getSettings() ?? {},
    (cwd) => {
      if (!store?.updateSettings) {
        throw new Error('runtime_unavailable')
      }
      store.updateSettings({ agentHubOrbCwd: cwd }, { notifyListeners: true })
    }
  )
  let permission = normalizeAgentHubOrbSettings(store?.getSettings() ?? {}).permission
  let enabled = runtime.isAgentHubEnabled()
  store?.onSettingsChanged?.(() => {
    const next = normalizeAgentHubOrbSettings(store.getSettings()).permission
    const restrict = permission === 'free' && next === 'ask'
    const nextEnabled = runtime.isAgentHubEnabled()
    const disabled = enabled && !nextEnabled
    permission = next
    enabled = nextEnabled
    if (restrict || disabled) {
      void manager.close().catch((error: unknown) => {
        console.warn('Could not stop Orb after its settings changed', error)
      })
    }
  })
  return manager
}

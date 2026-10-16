import { agentHubOrbPermissionOptions } from './agent-hub-orb-permission-settings'
import { stat } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import {
  AGENT_HUB_ORB_OPENING_PROMPT,
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
import { commitStructuredAgentSessionCreate } from '../../runtime/rpc/methods/structured-agent-session-create'
import { commitStructuredAgentSessionLaunchPrompt } from '../../runtime/rpc/methods/agent-launch-structured-prompt'
import { closeAgentHubOrbSession } from './agent-hub-orb-session-close'
import { listAgentHubOrbConversations } from './agent-hub-orb-history'
import { prepareAgentHubOrbSessionCreate } from './agent-hub-orb-session-create'
import {
  agentHubOrbSettingsNeedTransition,
  requireIdleAgentHubOrbSession
} from './agent-hub-orb-settings-transition'

const caller = { callerKey: 'trusted-local:agent-hub-orb' }
type OrbRuntime = Pick<
  OrcaRuntimeService,
  | 'isAgentHubEnabled'
  | 'ensureStructuredAgentSessionHost'
  | 'resolveStructuredAgentSessionCreateIntent'
  | 'publishStructuredAgentSessionTab'
  | 'closeMobileSessionTab'
> & { agentHub: Pick<OrcaRuntimeService['agentHub'], 'snapshot'> }

export class AgentHubOrbSessionManager {
  private opening: Promise<AgentHubOrbSession> | null = null
  private openingResumeId: string | undefined
  private openingSettingsKey: string | undefined
  private operations: Promise<void> = Promise.resolve()
  private active: AgentHubOrbSession | null = null
  private selectedSettings: ReturnType<typeof normalizeAgentHubOrbSettings> | null = null

  constructor(
    private readonly runtime: OrbRuntime,
    private readonly getSettings: () => AgentHubSettings,
    private readonly saveCwd: (cwd: string) => void | Promise<void>,
    private readonly saveModel?: (model: string | null) => void | Promise<void>
  ) {}

  requireEnabled(): void {
    if (!this.runtime.isAgentHubEnabled()) {
      throw new AgentHubError('disabled', 'Agent Hub Orb is disabled')
    }
  }

  current(): AgentHubOrbSession | null {
    this.requireEnabled()
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
    const settingsKey = JSON.stringify([settings.agent, settings.model, settings.permission])
    if (
      this.opening &&
      this.openingSettingsKey === settingsKey &&
      (!params.resume || params.resume.sessionId === this.openingResumeId)
    ) {
      return this.opening
    }
    const opening = this.enqueue(() => this.openOnce(params)).finally(() => {
      if (this.opening === opening) {
        this.opening = null
        this.openingResumeId = undefined
        this.openingSettingsKey = undefined
      }
    })
    this.opening = opening
    this.openingResumeId = params.resume?.sessionId
    this.openingSettingsKey = settingsKey
    return opening
  }

  close(): Promise<void> {
    this.requireEnabled()
    this.opening = null
    this.openingResumeId = undefined
    this.openingSettingsKey = undefined
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
    const host = await this.ensureHost()
    const current = this.current()
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
    this.selectedSettings ??= settings
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
      await this.ensureOpeningPrompt(host, current.sessionId)
      this.selectedSettings = settings
      return current
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
      if (current) {
        await this.closeOnce()
      }
      const revealed = await host.revealSession(previous.sessionId)
      await this.runtime.publishStructuredAgentSessionTab({
        workspaceId: revealed.workspaceId,
        sessionId: revealed.sessionId,
        agent: revealed.agent,
        activate: false
      })
      const tabId = host.getSessionTabId(previous.sessionId)
      this.active = { sessionId: previous.sessionId, ...(tabId ? { tabId } : {}), resumed: true }
      this.selectedSettings = settings
      await this.ensureOpeningPrompt(host, previous.sessionId)
      return this.active
    }
    const model = params.model === undefined ? settings.model : params.model
    const { prepared, model: resolvedModel } = await prepareAgentHubOrbSessionCreate({
      runtime: this.runtime,
      host,
      caller,
      agent,
      model,
      cwd,
      explicitModel: params.model !== undefined,
      permissionOptions: agentHubOrbPermissionOptions(this.getSettings(), agent)
    })
    this.requireEnabled()
    if (current) {
      await this.closeOnce()
    }
    const result = await commitStructuredAgentSessionCreate({
      runtime: this.runtime,
      caller,
      prepared,
      activate: false
    })
    if (!result.ok) {
      throw new AgentHubError('invalid_argument', result.refusal.message)
    }
    this.active = {
      sessionId: result.value.sessionId,
      ...(result.value.tabId ? { tabId: result.value.tabId } : {}),
      resumed: false
    }
    const latestSettings = normalizeAgentHubOrbSettings(this.getSettings())
    if (
      params.model === undefined &&
      this.saveModel &&
      resolvedModel !== settings.model &&
      latestSettings.agent === settings.agent &&
      latestSettings.model === settings.model
    ) {
      await this.saveModel?.(resolvedModel)
      this.selectedSettings = { ...settings, model: resolvedModel }
    } else {
      this.selectedSettings = settings
    }
    await this.ensureOpeningPrompt(host, result.value.sessionId)
    return this.active
  }

  private async ensureOpeningPrompt(
    host: StructuredAgentSessionHost,
    sessionId: string
  ): Promise<void> {
    const snapshot = await host.journalSnapshot(sessionId)
    if (snapshot.items.length > 0 || snapshot.submissions.length > 0) {
      return
    }
    const record = host.deps.store.getRecord(sessionId)
    if (!record) {
      throw new AgentHubError('not_found', 'Orb conversation was not found on this host')
    }
    const committed = await commitStructuredAgentSessionLaunchPrompt({
      host,
      caller,
      sessionId,
      fence: record.lease.runtimeFence,
      text: AGENT_HUB_ORB_OPENING_PROMPT
    })
    if (!committed) {
      throw new AgentHubError(
        'invalid_argument',
        'Orb was created but its opening prompt was not committed'
      )
    }
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
  store: Pick<RuntimeStore, 'getSettings' | 'updateSettings'> | null
): AgentHubOrbSessionManager {
  return new AgentHubOrbSessionManager(
    runtime,
    () => store?.getSettings() ?? {},
    (cwd) => {
      if (!store?.updateSettings) {
        throw new Error('runtime_unavailable')
      }
      store.updateSettings({ agentHubOrbCwd: cwd }, { notifyListeners: true })
    },
    (model) => {
      if (!store?.updateSettings) {
        throw new Error('runtime_unavailable')
      }
      store.updateSettings({ agentHubOrbModel: model }, { notifyListeners: true })
    }
  )
}
